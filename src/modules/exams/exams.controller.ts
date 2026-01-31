import type { Context } from "hono";
import { examsService } from "./exams.service";
import {
	createExamSchema,
	updateExamSchema,
	addQuestionsSchema,
	submitAnswerSchema,
	batchSubmitAnswersSchema,
	listExamsQuerySchema,
	createQuestionSchema,
	updateQuestionSchema,
	listQuestionsQuerySchema,
} from "./exams.schema";
import type { AppVariables } from "../../types";
import { Role } from "../../types";

export const examsController = {
	// === EXAM MANAGEMENT (GURU) ===

	// POST /exams
	async createExam(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");
		const body = await c.req.json();
		const input = createExamSchema.parse(body);

		const exam = await examsService.createExam(user.sub, input);

		return c.json(
			{
				success: true,
				data: exam,
				message: "Exam created successfully",
			},
			201,
		);
	},

	// GET /exams
	async listExams(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");
		const queryParams = c.req.query();
		const query = listExamsQuerySchema.parse(queryParams);

		let result;
		if (user.role === Role.GURU) {
			result = await examsService.listExams(user.sub, query);
		} else {
			result = await examsService.listAvailableExams(query);
		}

		return c.json({
			success: true,
			data: result.data,
			pagination: result.pagination,
		});
	},

	// GET /exams/:id
	async getExam(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");
		const examId = c.req.param("id");
		const isTeacher = user.role === Role.GURU;

		const exam = await examsService.getExam(examId, user.sub, isTeacher);

		return c.json({
			success: true,
			data: exam,
		});
	},

	// PUT /exams/:id
	async updateExam(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");
		const examId = c.req.param("id");
		const body = await c.req.json();
		const input = updateExamSchema.parse(body);

		const exam = await examsService.updateExam(examId, user.sub, input);

		return c.json({
			success: true,
			data: exam,
			message: "Exam updated successfully",
		});
	},

	// DELETE /exams/:id
	async deleteExam(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");
		const examId = c.req.param("id");

		await examsService.deleteExam(examId, user.sub);

		return c.json({
			success: true,
			message: "Exam deleted successfully",
		});
	},

	// PATCH /exams/:id/status
	async updateExamStatus(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");
		const examId = c.req.param("id");
		const body = await c.req.json();

		const { status } = body as {
			status: "DRAFT" | "ONGOING" | "FINISHED" | "PUBLISHED";
		};

		if (!["DRAFT", "ONGOING", "FINISHED", "PUBLISHED"].includes(status)) {
			return c.json(
				{
					success: false,
					message:
						"Invalid status. Must be DRAFT, ONGOING, FINISHED, or PUBLISHED",
				},
				400,
			);
		}

		const exam = await examsService.updateExamStatus(
			examId,
			user.sub,
			status,
		);

		return c.json({
			success: true,
			data: exam,
			message: `Exam status updated to ${status}`,
		});
	},

	// POST /exams/:id/questions
	async addQuestions(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");
		const examId = c.req.param("id");
		const body = await c.req.json();
		const input = addQuestionsSchema.parse(body);

		const exam = await examsService.addQuestionsToExam(
			examId,
			user.sub,
			input,
		);

		return c.json({
			success: true,
			data: exam,
			message: "Questions added successfully",
		});
	},

	// DELETE /exams/:id/questions/:questionId
	async removeQuestion(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");
		const examId = c.req.param("id");
		const questionId = c.req.param("questionId");

		await examsService.removeQuestionFromExam(examId, user.sub, questionId);

		return c.json({
			success: true,
			message: "Question removed successfully",
		});
	},

	// POST /exams/:id/publish
	async publishExam(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");
		const examId = c.req.param("id");

		const exam = await examsService.publishExam(examId, user.sub);

		return c.json({
			success: true,
			data: exam,
			message: "Exam published successfully",
		});
	},

	// POST /exams/:id/end
	async endExam(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");
		const examId = c.req.param("id");

		const exam = await examsService.endExam(examId, user.sub);

		return c.json({
			success: true,
			data: exam,
			message: "Exam ended successfully",
		});
	},

	// GET /exams/:id/participants
	async getParticipants(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");
		const examId = c.req.param("id");

		const participants = await examsService.getExamParticipants(
			examId,
			user.sub,
		);

		return c.json({
			success: true,
			data: participants,
		});
	},

	// === STUDENT EXAM ACTIONS ===

	// POST /exams/:id/join
	async joinExam(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");
		const examId = c.req.param("id");

		const result = await examsService.joinExam(
			examId,
			user.sub,
			user.email,
		);

		return c.json({
			success: true,
			data: result,
			message: result.alreadyJoined
				? "Already joined exam"
				: "Joined exam successfully",
		});
	},

	// POST /exams/:id/submit
	async submitAnswer(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");
		const examId = c.req.param("id");
		const body = await c.req.json();
		const input = submitAnswerSchema.parse(body);

		const answer = await examsService.submitAnswer(examId, user.sub, input);

		return c.json({
			success: true,
			data: answer,
			message: "Answer submitted successfully",
		});
	},

	// POST /exams/:id/submit-batch
	async batchSubmitAnswers(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");
		const examId = c.req.param("id");
		const body = await c.req.json();
		const input = batchSubmitAnswersSchema.parse(body);

		const answers = await examsService.batchSubmitAnswers(
			examId,
			user.sub,
			input,
		);

		return c.json({
			success: true,
			data: answers,
			message: "Answers submitted successfully",
		});
	},

	// POST /exams/:id/finish
	async finishExam(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");
		const examId = c.req.param("id");

		const participant = await examsService.finishExam(examId, user.sub);

		return c.json({
			success: true,
			data: participant,
			message: "Exam submitted successfully",
		});
	},

	// GET /exams/:id/status
	async getExamStatus(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");
		const examId = c.req.param("id");

		const status = await examsService.getStudentExamStatus(
			examId,
			user.sub,
		);

		return c.json({
			success: true,
			data: status,
		});
	},

	// GET /exams/my-exams
	async getMyExams(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");

		const exams = await examsService.getStudentExams(user.sub);

		return c.json({
			success: true,
			data: exams,
		});
	},

	// === QUESTION MANAGEMENT ===

	// POST /questions
	async createQuestion(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");
		const body = await c.req.json();
		const input = createQuestionSchema.parse(body);

		const question = await examsService.createQuestion(user.sub, input);

		return c.json(
			{
				success: true,
				data: question,
				message: "Question created successfully",
			},
			201,
		);
	},

	// GET /questions
	async listQuestions(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");
		const queryParams = c.req.query();
		const query = listQuestionsQuerySchema.parse(queryParams);

		const result = await examsService.listQuestions(user.sub, query);

		return c.json({
			success: true,
			data: result.data,
			pagination: result.pagination,
		});
	},

	// GET /questions/:id
	async getQuestion(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");
		const questionId = c.req.param("id");

		const question = await examsService.getQuestion(questionId, user.sub);

		return c.json({
			success: true,
			data: question,
		});
	},

	// PUT /questions/:id
	async updateQuestion(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");
		const questionId = c.req.param("id");
		const body = await c.req.json();
		const input = updateQuestionSchema.parse(body);

		const question = await examsService.updateQuestion(
			questionId,
			user.sub,
			input,
		);

		return c.json({
			success: true,
			data: question,
			message: "Question updated successfully",
		});
	},

	// DELETE /questions/:id
	async deleteQuestion(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");
		const questionId = c.req.param("id");

		await examsService.deleteQuestion(questionId, user.sub);

		return c.json({
			success: true,
			message: "Question deleted successfully",
		});
	},
};
