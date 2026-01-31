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
import { aesScorerService } from "../../services/aes-scorer.service";

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

		// Get exam questions with order
		const examQuestionsOrdered =
			await examsRepository.getExamQuestions(examId);
		const questionOrderMap = new Map(
			examQuestionsOrdered.map((eq, index) => [
				eq.questionId,
				eq.order ?? index,
			]),
		);

		const participantAnswers =
			await examsRepository.getParticipantAnswers(participantId);

		// Sort answers by question order
		const sortedAnswers = participantAnswers.sort((a, b) => {
			const orderA = questionOrderMap.get(a.questionId) ?? 999;
			const orderB = questionOrderMap.get(b.questionId) ?? 999;
			return orderA - orderB;
		});

		return {
			participant,
			answers: sortedAnswers,
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

					let aiScore: number | null = null;
					let feedbackJson: string | null = null;

					if (
						answer.question.type === "PG" &&
						answer.question.answerKey
					) {
						// Auto-scoring for PG (Multiple Choice)
						const studentAnswer =
							answer.answerText?.toLowerCase().trim() || "";
						const key = answer.question.answerKey
							.toLowerCase()
							.trim();

						const isCorrect = studentAnswer === key;

						logger.debug(
							{
								answerId: answer.id,
								studentAnswer,
								key,
								match: isCorrect,
								originalAnswer: answer.answerText,
								originalKey: answer.question.answerKey,
							},
							"PG Scoring comparison",
						);

						aiScore = isCorrect ? 100 : 0;
						feedbackJson = JSON.stringify({
							overall: isCorrect
								? "Jawaban benar"
								: "Jawaban salah",
							strengths: [],
							improvements: [],
						});
					} else if (answer.question.type === "ESSAY") {
						// AI scoring for essay questions
						try {
							const rubric = answer.question.rubric as Record<
								string,
								number
							> | null;

							// Check if answer has image/file URL (image-based answer)
							if (
								answer.answerFileUrl &&
								answer.question.answerKey
							) {
								// Score from image using OCR
								const imageResult =
									await aesScorerService.scoreImage(
										answer.answerFileUrl,
										answer.question.answerKey,
										rubric || undefined,
										answer.question.question,
									);

								if (imageResult.scoring_result) {
									aiScore = imageResult.scoring_result.score;
									feedbackJson = JSON.stringify({
										overall:
											imageResult.scoring_result.feedback
												.overall,
										strengths:
											imageResult.scoring_result.feedback
												.strengths,
										improvements:
											imageResult.scoring_result.feedback
												.improvements,
										rubric_breakdown:
											imageResult.scoring_result
												.rubric_breakdown,
										total_points:
											imageResult.scoring_result
												.total_points,
										max_points:
											imageResult.scoring_result
												.max_points,
										extracted_text:
											imageResult.extracted_text,
									});
								} else {
									aiScore = 0;
									feedbackJson = JSON.stringify({
										overall:
											"OCR gagal mengekstrak teks dari gambar",
										strengths: [],
										improvements: [],
									});
								}

								logger.debug(
									{ score: aiScore, hasOCR: true },
									`AI scored image essay for answer: ${answer.id}`,
								);
							} else if (
								answer.answerText &&
								answer.question.answerKey
							) {
								// Score from text
								const scoringResult =
									await aesScorerService.scoreText(
										answer.answerText,
										answer.question.answerKey,
										rubric || undefined,
										answer.question.question,
									);

								aiScore = scoringResult.score;
								feedbackJson = JSON.stringify({
									overall: scoringResult.feedback.overall,
									strengths: scoringResult.feedback.strengths,
									improvements:
										scoringResult.feedback.improvements,
									rubric_breakdown:
										scoringResult.rubric_breakdown,
									total_points: scoringResult.total_points,
									max_points: scoringResult.max_points,
								});

								logger.debug(
									{ score: aiScore },
									`AI scored essay for answer: ${answer.id}`,
								);
							} else {
								// Missing answer or key - set default
								aiScore = 0;
								feedbackJson = JSON.stringify({
									overall:
										"Tidak ada jawaban atau kunci jawaban tidak tersedia",
									strengths: [],
									improvements: [],
								});
							}
						} catch (aiError) {
							logger.error(
								{ err: aiError },
								`AI scoring failed for answer: ${answer.id}, using fallback`,
							);
							// Fallback - set placeholder score
							aiScore = 50;
							feedbackJson = JSON.stringify({
								overall:
									"Penilaian AI gagal, perlu review manual",
								strengths: [],
								improvements: [],
							});
						}
					}

					// Update answer with AI score and feedback
					await db
						.update(answers)
						.set({
							aiScore,
							finalScore: aiScore,
							feedback: feedbackJson,
							status: "SCORED",
							updatedAt: new Date(),
						})
						.where(eq(answers.id, answer.id));
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
