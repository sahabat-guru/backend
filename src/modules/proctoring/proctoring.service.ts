import { proctoringRepository } from "./proctoring.repository";
import { examsRepository } from "../exams/exams.repository";
import { proctoringAIService } from "../../services/proctoring-ai.service";
import { emitProctoringAlert } from "../../libs/websocket";
import {
	NotFoundError,
	ForbiddenError,
} from "../../middlewares/error.middleware";
import { logger } from "../../libs/config";
import type {
	ReportEventInput,
	BrowserEventInput,
	ListLogsQuery,
} from "./proctoring.schema";
import { ProctoringEventType } from "../../types";

export const proctoringService = {
	// Report proctoring event (from student/AI)
	async reportEvent(input: ReportEventInput) {
		// Find participant by session
		const participant = await proctoringRepository.findParticipantBySession(
			input.sessionId,
		);

		if (!participant) {
			logger.warn(
				{ sessionId: input.sessionId },
				"Proctoring event for unknown session",
			);
			throw new NotFoundError("Proctoring session");
		}

		// Create log entry
		const log = await proctoringRepository.createLog({
			examId: participant.examId,
			studentId: participant.studentId,
			participantId: participant.id,
			eventType: input.eventType as ProctoringEventType,
			confidence: input.confidence,
			details: input.details,
			snapshotUrl: input.snapshotUrl,
		});

		// Emit real-time alert to teacher
		emitProctoringAlert(participant.examId, {
			studentId: participant.studentId,
			studentName: participant.student.name,
			examId: participant.examId,
			type: input.eventType as ProctoringEventType,
			confidence: input.confidence || 0,
			timestamp: new Date(),
		});

		// Update suspicious count in exam statistics
		const violationCount =
			await proctoringRepository.countViolationsByStudent(
				participant.examId,
				participant.studentId,
			);
		const totalViolations = violationCount.reduce(
			(sum, v) => sum + Number(v.count),
			0,
		);

		// Mark as suspicious if violations exceed threshold
		if (totalViolations >= 5) {
			const stats = await examsRepository.getStatistics(
				participant.examId,
			);
			const suspiciousStudents =
				await proctoringRepository.getSuspiciousStudents(
					participant.examId,
				);
			await examsRepository.upsertStatistics(participant.examId, {
				suspiciousCount: suspiciousStudents.length,
			});
		}

		logger.info(
			{
				examId: participant.examId,
				studentId: participant.studentId,
				eventType: input.eventType,
			},
			"Proctoring event recorded",
		);

		return log;
	},

	// Report browser event
	async reportBrowserEvent(input: BrowserEventInput) {
		// Find participant by session
		const participant = await proctoringRepository.findParticipantBySession(
			input.sessionId,
		);

		if (!participant) {
			throw new NotFoundError("Proctoring session");
		}

		// Forward to external proctoring service
		try {
			await proctoringAIService.reportBrowserEvent({
				session_id: input.sessionId,
				event_type: input.eventType,
				details: input.details || {},
			});
		} catch (error) {
			logger.error(
				{ err: error },
				"Failed to report browser event to proctoring service",
			);
		}

		logger.debug(
			{ sessionId: input.sessionId, eventType: input.eventType },
			"Browser event reported",
		);

		return { success: true };
	},

	// Get proctoring logs for exam (teacher only)
	async getExamLogs(examId: string, teacherId: string, query: ListLogsQuery) {
		const exam = await examsRepository.findExamByIdAndTeacher(
			examId,
			teacherId,
		);

		if (!exam) {
			throw new NotFoundError("Exam");
		}

		return proctoringRepository.getLogsByExam(examId, query);
	},

	// Get proctoring stats for exam (teacher only)
	async getExamStats(examId: string, teacherId: string) {
		const exam = await examsRepository.findExamByIdAndTeacher(
			examId,
			teacherId,
		);

		if (!exam) {
			throw new NotFoundError("Exam");
		}

		return proctoringRepository.getExamProctoringStats(examId);
	},

	// Get student proctoring logs (teacher only)
	async getStudentLogs(examId: string, studentId: string, teacherId: string) {
		const exam = await examsRepository.findExamByIdAndTeacher(
			examId,
			teacherId,
		);

		if (!exam) {
			throw new NotFoundError("Exam");
		}

		const [logs, violationCounts] = await Promise.all([
			proctoringRepository.getLogsByStudent(examId, studentId),
			proctoringRepository.countViolationsByStudent(examId, studentId),
		]);

		return {
			logs,
			summary: {
				totalViolations: logs.length,
				violationsByType: violationCounts,
			},
		};
	},

	// Get session info from external service
	async getSessionInfo(sessionId: string) {
		try {
			const session = await proctoringAIService.getSession(sessionId);
			return session;
		} catch (error) {
			logger.error({ err: error }, "Failed to get session info");
			throw new NotFoundError("Proctoring session");
		}
	},

	// Get session events from external service
	async getSessionEvents(sessionId: string) {
		try {
			const events =
				await proctoringAIService.getSessionEvents(sessionId);
			return events;
		} catch (error) {
			logger.error({ err: error }, "Failed to get session events");
			return [];
		}
	},
};
