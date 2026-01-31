import type { Context } from "hono";
import { proctoringService } from "./proctoring.service";
import {
	reportEventSchema,
	browserEventSchema,
	listLogsQuerySchema,
	startSessionSchema,
} from "./proctoring.schema";
import type { AppVariables } from "../../types";

export const proctoringController = {
	// POST /proctoring/sessions/start
	async startSession(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");
		const body = await c.req.json();
		const input = startSessionSchema.parse(body);

		const result = await proctoringService.startProctoringSession({
			studentId: user.sub,
			studentName: user.name,
			examId: input.examId,
			examName: input.examName,
		});

		return c.json(
			{
				success: true,
				data: result,
				message: "Proctoring session started",
			},
			201,
		);
	},

	// POST /proctoring/sessions/:sessionId/end
	async endSession(c: Context<{ Variables: AppVariables }>) {
		const sessionId = c.req.param("sessionId");

		await proctoringService.endProctoringSession(sessionId);

		return c.json({
			success: true,
			message: "Proctoring session ended",
		});
	},

	// GET /proctoring/sessions/active
	async getActiveSessions(c: Context<{ Variables: AppVariables }>) {
		const sessions = await proctoringService.getActiveSessions();

		return c.json({
			success: true,
			data: sessions,
		});
	},

	// POST /proctoring/events
	async reportEvent(c: Context<{ Variables: AppVariables }>) {
		const body = await c.req.json();
		const input = reportEventSchema.parse(body);

		const log = await proctoringService.reportEvent(input);

		return c.json(
			{
				success: true,
				data: log,
				message: "Event recorded",
			},
			201,
		);
	},

	// POST /proctoring/browser-events
	async reportBrowserEvent(c: Context<{ Variables: AppVariables }>) {
		const body = await c.req.json();
		const input = browserEventSchema.parse(body);

		await proctoringService.reportBrowserEvent(input);

		return c.json({
			success: true,
			message: "Browser event reported",
		});
	},

	// GET /proctoring/exams/:examId/logs
	async getExamLogs(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");
		const examId = c.req.param("examId");
		const queryParams = c.req.query();
		const query = listLogsQuerySchema.parse(queryParams);

		const result = await proctoringService.getExamLogs(
			examId,
			user.sub,
			query,
		);

		return c.json({
			success: true,
			data: result.data,
			pagination: result.pagination,
		});
	},

	// GET /proctoring/exams/:examId/stats
	async getExamStats(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");
		const examId = c.req.param("examId");

		const stats = await proctoringService.getExamStats(examId, user.sub);

		return c.json({
			success: true,
			data: stats,
		});
	},

	// GET /proctoring/exams/:examId/students/:studentId
	async getStudentLogs(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");
		const examId = c.req.param("examId");
		const studentId = c.req.param("studentId");

		const result = await proctoringService.getStudentLogs(
			examId,
			studentId,
			user.sub,
		);

		return c.json({
			success: true,
			data: result,
		});
	},

	// GET /proctoring/sessions/:sessionId
	async getSessionInfo(c: Context<{ Variables: AppVariables }>) {
		const sessionId = c.req.param("sessionId");

		const session = await proctoringService.getSessionInfo(sessionId);

		return c.json({
			success: true,
			data: session,
		});
	},

	// GET /proctoring/sessions/:sessionId/events
	async getSessionEvents(c: Context<{ Variables: AppVariables }>) {
		const sessionId = c.req.param("sessionId");

		const events = await proctoringService.getSessionEvents(sessionId);

		return c.json({
			success: true,
			data: events,
		});
	},
};

