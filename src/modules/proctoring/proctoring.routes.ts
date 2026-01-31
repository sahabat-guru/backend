import { Hono } from "hono";
import { proctoringController } from "./proctoring.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { guruOnly, muridOnly } from "../../middlewares/role.guard";
import type { AppVariables } from "../../types";

const proctoringRoutes = new Hono<{ Variables: AppVariables }>();

// All routes require authentication
proctoringRoutes.use("*", authMiddleware);

// Event reporting (from student client)
proctoringRoutes.post("/events", muridOnly, proctoringController.reportEvent);
proctoringRoutes.post(
	"/browser-events",
	muridOnly,
	proctoringController.reportBrowserEvent,
);

// Log viewing (GURU only)
proctoringRoutes.get(
	"/exams/:examId/logs",
	guruOnly,
	proctoringController.getExamLogs,
);
proctoringRoutes.get(
	"/exams/:examId/stats",
	guruOnly,
	proctoringController.getExamStats,
);
proctoringRoutes.get(
	"/exams/:examId/students/:studentId",
	guruOnly,
	proctoringController.getStudentLogs,
);

// Session info (authenticated)
proctoringRoutes.get(
	"/sessions/:sessionId",
	proctoringController.getSessionInfo,
);
proctoringRoutes.get(
	"/sessions/:sessionId/events",
	proctoringController.getSessionEvents,
);

export { proctoringRoutes };
