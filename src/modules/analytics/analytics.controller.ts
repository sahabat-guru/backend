import type { Context } from "hono";
import { analyticsService } from "./analytics.service";
import { analyticsQuerySchema } from "./analytics.schema";
import type { AppVariables } from "../../types";

export const analyticsController = {
	// GET /analytics/exams/:examId
	async getExamAnalytics(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");
		const examId = c.req.param("examId");

		const analytics = await analyticsService.getExamAnalytics(
			examId,
			user.sub,
		);

		return c.json({
			success: true,
			data: analytics,
		});
	},

	// GET /analytics/overview
	async getOverviewAnalytics(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");
		const queryParams = c.req.query();
		const query = analyticsQuerySchema.parse(queryParams);

		const analytics = await analyticsService.getOverviewAnalytics(
			user.sub,
			query,
		);

		return c.json({
			success: true,
			data: analytics,
		});
	},

	// GET /analytics/students/:studentId
	async getStudentAnalytics(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");
		const studentId = c.req.param("studentId");

		const analytics = await analyticsService.getStudentAnalytics(
			studentId,
			user.sub,
		);

		return c.json({
			success: true,
			data: analytics,
		});
	},
};
