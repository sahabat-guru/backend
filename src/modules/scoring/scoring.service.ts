import { eq, and, sql } from "drizzle-orm";
import { db } from "../../libs/db";
import { examsRepository } from "../exams/exams.repository";
import {
	NotFoundError,
	ForbiddenError,
	BadRequestError,
} from "../../middlewares/error.middleware";
import { logger } from "../../libs/config";
import {
	answers,
	examParticipants,
	questions,
	examStatistics,
} from "../../libs/db/schema";
import type { OverrideScoreInput, TriggerScoringInput } from "./scoring.schema";

// Simple scoring job queue (in-memory for MVP, use Redis/DB queue in production)
interface ScoringJob {
	examId: string;
	participantId: string;
	status: "pending" | "processing" | "done" | "failed";
	createdAt: Date;
	completedAt?: Date;
	error?: string;
}

const scoringQueue: Map<string, ScoringJob> = new Map();

export const scoringService = {
	// Get exam scores (for teacher)
	async getExamScores(examId: string, teacherId: string) {
		const exam = await examsRepository.findExamByIdAndTeacher(
			examId,
			teacherId,
		);

		if (!exam) {
			throw new NotFoundError("Exam");
		}

		const participants = await examsRepository.listParticipants(examId);

		// Calculate score distribution
		const scores = participants
			.filter((p) => p.score !== null)
			.map((p) => p.score as number);

		const stats =
			scores.length > 0
				? {
						average:
							scores.reduce((a, b) => a + b, 0) / scores.length,
						highest: Math.max(...scores),
						lowest: Math.min(...scores),
						submitted: participants.filter((p) => p.submitTime)
							.length,
						scored: scores.length,
						total: participants.length,
					}
				: {
						average: 0,
						highest: 0,
						lowest: 0,
						submitted: participants.filter((p) => p.submitTime)
							.length,
						scored: 0,
						total: participants.length,
					};

		return {
			participants: participants.map((p) => ({
				id: p.id,
				student: p.student,
				startTime: p.startTime,
				submitTime: p.submitTime,
				score: p.score,
				status: p.status,
				answersCount: p.answers?.length || 0,
			})),
			stats,
		};
	},

	// Get participant answers with scores
	async getParticipantAnswers(
		examId: string,
		participantId: string,
		teacherId: string,
	) {
		const exam = await examsRepository.findExamByIdAndTeacher(
			examId,
			teacherId,
		);

		if (!exam) {
			throw new NotFoundError("Exam");
		}

		const participant =
			await examsRepository.findParticipantById(participantId);

		if (!participant || participant.examId !== examId) {
			throw new NotFoundError("Participant");
		}

		const participantAnswers =
			await examsRepository.getParticipantAnswers(participantId);

		return {
			participant,
			answers: participantAnswers,
		};
	},

	// Override score manually
	async overrideScore(
		answerId: string,
		teacherId: string,
		input: OverrideScoreInput,
	) {
		// Get answer with related data
		const answer = await db.query.answers.findFirst({
			where: eq(answers.id, answerId),
			with: {
				participant: {
					with: {
						exam: true,
					},
				},
				question: true,
			},
		});

		if (!answer) {
			throw new NotFoundError("Answer");
		}

		if (answer.participant.exam.teacherId !== teacherId) {
			throw new ForbiddenError("You do not have access to this answer");
		}

		// Update answer score
		const [updated] = await db
			.update(answers)
			.set({
				finalScore: input.finalScore,
				feedback: input.feedback,
				status: "SCORED",
				updatedAt: new Date(),
			})
			.where(eq(answers.id, answerId))
			.returning();

		// Recalculate participant total score
		await this.recalculateParticipantScore(answer.participantId);

		logger.info(
			{ finalScore: input.finalScore },
			`Score overridden: ${answerId}`,
		);

		return updated;
	},

	// Trigger AI scoring for exam
	async triggerScoring(
		examId: string,
		teacherId: string,
		input: TriggerScoringInput,
	) {
		const exam = await examsRepository.findExamByIdAndTeacher(
			examId,
			teacherId,
		);

		if (!exam) {
			throw new NotFoundError("Exam");
		}

		const participants = await examsRepository.listParticipants(examId);

		// Filter participants to score
		let toScore = participants.filter((p) => p.submitTime);
		if (input.participantIds && input.participantIds.length > 0) {
			toScore = toScore.filter((p) =>
				input.participantIds!.includes(p.id),
			);
		}

		// Add to scoring queue
		const jobs: ScoringJob[] = [];
		for (const participant of toScore) {
			const job: ScoringJob = {
				examId,
				participantId: participant.id,
				status: "pending",
				createdAt: new Date(),
			};
			scoringQueue.set(participant.id, job);
			jobs.push(job);
		}

		// Start background scoring (async)
		this.processScoring(
			examId,
			toScore.map((p) => p.id),
		);

		logger.info(
			{ count: toScore.length },
			`Scoring triggered for exam: ${examId}`,
		);

		return {
			triggered: toScore.length,
			jobs: jobs.map((j) => ({
				participantId: j.participantId,
				status: j.status,
			})),
		};
	},

	// Get scoring status
	async getScoringStatus(examId: string, teacherId: string) {
		const exam = await examsRepository.findExamByIdAndTeacher(
			examId,
			teacherId,
		);

		if (!exam) {
			throw new NotFoundError("Exam");
		}

		const jobs = Array.from(scoringQueue.values()).filter(
			(j) => j.examId === examId,
		);

		return {
			pending: jobs.filter((j) => j.status === "pending").length,
			processing: jobs.filter((j) => j.status === "processing").length,
			done: jobs.filter((j) => j.status === "done").length,
			failed: jobs.filter((j) => j.status === "failed").length,
		};
	},

	// Process scoring in background
	async processScoring(examId: string, participantIds: string[]) {
		for (const participantId of participantIds) {
			const job = scoringQueue.get(participantId);
			if (!job) continue;

			try {
				job.status = "processing";

				// Get participant answers
				const participantAnswers =
					await examsRepository.getParticipantAnswers(participantId);

				// Score each answer
				for (const answer of participantAnswers) {
					if (answer.status === "SCORED") continue;

					// Simple auto-scoring for PG (Pilihan Ganda)
					let aiScore: number | null = null;

					if (
						answer.question.type === "PG" &&
						answer.question.answerKey
					) {
						// Check if answer matches key
						const isCorrect =
							answer.answerText?.toUpperCase().trim() ===
							answer.question.answerKey.toUpperCase().trim();
						aiScore = isCorrect ? 100 : 0;
					} else if (answer.question.type === "ESSAY") {
						// For essay, set a default score (in production, call AI scoring API)
						aiScore = 50; // Placeholder - needs manual review
					}

					// Update answer
					await examsRepository.updateAnswerScore(
						answer.id,
						aiScore,
						aiScore,
					);
				}

				// Recalculate total score
				await this.recalculateParticipantScore(participantId);

				job.status = "done";
				job.completedAt = new Date();

				logger.debug(
					`Scoring completed for participant: ${participantId}`,
				);
			} catch (error) {
				job.status = "failed";
				job.error =
					error instanceof Error ? error.message : "Unknown error";
				logger.error(
					{ err: error },
					`Scoring failed for participant: ${participantId}`,
				);
			}
		}

		// Update exam statistics
		await this.updateExamStatistics(examId);
	},

	// Recalculate participant total score
	async recalculateParticipantScore(participantId: string) {
		const participantAnswers =
			await examsRepository.getParticipantAnswers(participantId);

		const scoredAnswers = participantAnswers.filter(
			(a) => a.finalScore !== null,
		);

		if (scoredAnswers.length === 0) {
			return;
		}

		// Calculate average score
		const totalScore = scoredAnswers.reduce(
			(sum, a) => sum + (a.finalScore || 0),
			0,
		);
		const averageScore = totalScore / scoredAnswers.length;

		// Update participant
		await examsRepository.updateParticipant(participantId, {
			score: averageScore,
			status: "SCORED",
		});

		logger.debug(
			{ score: averageScore },
			`Participant score recalculated: ${participantId}`,
		);
	},

	// Update exam statistics
	async updateExamStatistics(examId: string) {
		const participants = await examsRepository.listParticipants(examId);

		const scores = participants
			.filter((p) => p.score !== null)
			.map((p) => p.score as number);

		if (scores.length === 0) {
			return;
		}

		await examsRepository.upsertStatistics(examId, {
			avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
			maxScore: Math.max(...scores),
			minScore: Math.min(...scores),
			totalParticipants: participants.length,
			submittedCount: participants.filter((p) => p.submitTime).length,
			scoredCount: scores.length,
		});

		logger.debug(`Exam statistics updated: ${examId}`);
	},
};
