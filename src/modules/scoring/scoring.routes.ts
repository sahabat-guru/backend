import { Hono } from "hono";
import { scoringController } from "./scoring.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { guruOnly } from "../../middlewares/role.guard";
import type { AppVariables } from "../../types";

const scoringRoutes = new Hono<{ Variables: AppVariables }>();

// All routes require authentication and GURU role
scoringRoutes.use("*", authMiddleware, guruOnly);

// Exam scores
scoringRoutes.get("/exams/:examId", scoringController.getExamScores);
scoringRoutes.get(
	"/exams/:examId/participants/:participantId",
	scoringController.getParticipantAnswers,
);
scoringRoutes.get("/exams/:examId/status", scoringController.getScoringStatus);

// Scoring actions
scoringRoutes.post("/exams/:examId/trigger", scoringController.triggerScoring);
scoringRoutes.put("/answers/:answerId", scoringController.overrideScore);

export { scoringRoutes };
