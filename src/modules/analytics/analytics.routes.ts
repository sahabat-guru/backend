import { Hono } from "hono";
import { analyticsController } from "./analytics.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { guruOnly } from "../../middlewares/role.guard";
import type { AppVariables } from "../../types";

const analyticsRoutes = new Hono<{ Variables: AppVariables }>();

// All routes require authentication and GURU role
analyticsRoutes.use("*", authMiddleware, guruOnly);

// Analytics routes
analyticsRoutes.get("/overview", analyticsController.getOverviewAnalytics);
analyticsRoutes.get("/exams/:examId", analyticsController.getExamAnalytics);
analyticsRoutes.get(
	"/students/:studentId",
	analyticsController.getStudentAnalytics,
);

export { analyticsRoutes };
