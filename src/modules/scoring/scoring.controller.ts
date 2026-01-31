import type { Context } from "hono";
import { scoringService } from "./scoring.service";
import { overrideScoreSchema, triggerScoringSchema } from "./scoring.schema";
import type { AppVariables } from "../../types";

export const scoringController = {
	// GET /scoring/exams/:examId
	async getExamScores(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");
		const examId = c.req.param("examId");

		const result = await scoringService.getExamScores(examId, user.sub);

		return c.json({
			success: true,
			data: result,
		});
	},

	// GET /scoring/exams/:examId/participants/:participantId
	async getParticipantAnswers(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");
		const examId = c.req.param("examId");
		const participantId = c.req.param("participantId");

		const result = await scoringService.getParticipantAnswers(
			examId,
			participantId,
			user.sub,
		);

		return c.json({
			success: true,
			data: result,
		});
	},

	// PUT /scoring/answers/:answerId
	async overrideScore(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");
		const answerId = c.req.param("answerId");
		const body = await c.req.json();
		const input = overrideScoreSchema.parse(body);

		const answer = await scoringService.overrideScore(
			answerId,
			user.sub,
			input,
		);

		return c.json({
			success: true,
			data: answer,
			message: "Score updated successfully",
		});
	},

	// POST /scoring/exams/:examId/trigger
	async triggerScoring(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");
		const examId = c.req.param("examId");
		const body = await c.req.json().catch(() => ({}));
		const input = triggerScoringSchema.parse(body);

		const result = await scoringService.triggerScoring(
			examId,
			user.sub,
			input,
		);

		return c.json({
			success: true,
			data: result,
			message: "Scoring triggered",
		});
	},

	// GET /scoring/exams/:examId/status
	async getScoringStatus(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");
		const examId = c.req.param("examId");

		const status = await scoringService.getScoringStatus(examId, user.sub);

		return c.json({
			success: true,
			data: status,
		});
	},
};
