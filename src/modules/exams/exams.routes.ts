import { Hono } from "hono";
import { examsController } from "./exams.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { guruOnly, muridOnly, anyRole } from "../../middlewares/role.guard";
import type { AppVariables } from "../../types";

const examsRoutes = new Hono<{ Variables: AppVariables }>();
const questionsRoutes = new Hono<{ Variables: AppVariables }>();

// All routes require authentication
examsRoutes.use("*", authMiddleware);
questionsRoutes.use("*", authMiddleware);

// === EXAM ROUTES ===

// List exams (both roles)
examsRoutes.get("/", anyRole, examsController.listExams);

// Student specific routes (must be before :id routes)
examsRoutes.get("/my-exams", muridOnly, examsController.getMyExams);

// Create exam (GURU only)
examsRoutes.post("/", guruOnly, examsController.createExam);

// Get exam details (both roles)
examsRoutes.get("/:id", anyRole, examsController.getExam);

// Update exam (GURU only)
examsRoutes.put("/:id", guruOnly, examsController.updateExam);

// Delete exam (GURU only)
examsRoutes.delete("/:id", guruOnly, examsController.deleteExam);

// Update exam status (GURU only)
examsRoutes.patch("/:id/status", guruOnly, examsController.updateExamStatus);

// Manage questions in exam (GURU only)
examsRoutes.post("/:id/questions", guruOnly, examsController.addQuestions);
examsRoutes.delete(
	"/:id/questions/:questionId",
	guruOnly,
	examsController.removeQuestion,
);

// Publish/end exam (GURU only)
examsRoutes.post("/:id/publish", guruOnly, examsController.publishExam);
examsRoutes.post("/:id/end", guruOnly, examsController.endExam);

// Get participants (GURU only)
examsRoutes.get("/:id/participants", guruOnly, examsController.getParticipants);

// Student exam actions (MURID only)
examsRoutes.post("/:id/join", muridOnly, examsController.joinExam);
examsRoutes.post("/:id/submit", muridOnly, examsController.submitAnswer);
examsRoutes.post(
	"/:id/submit-batch",
	muridOnly,
	examsController.batchSubmitAnswers,
);
examsRoutes.post("/:id/finish", muridOnly, examsController.finishExam);
examsRoutes.get("/:id/status", muridOnly, examsController.getExamStatus);

// === QUESTION ROUTES (GURU only) ===

questionsRoutes.use("*", guruOnly);

questionsRoutes.post("/", examsController.createQuestion);
questionsRoutes.get("/", examsController.listQuestions);
questionsRoutes.get("/:id", examsController.getQuestion);
questionsRoutes.put("/:id", examsController.updateQuestion);
questionsRoutes.delete("/:id", examsController.deleteQuestion);

export { examsRoutes, questionsRoutes };
