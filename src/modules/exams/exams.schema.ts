import { z } from "zod";

// Create exam schema
export const createExamSchema = z.object({
	title: z.string().min(1, "Title is required").max(200),
	description: z.string().optional(),
	startTime: z.string().datetime().optional(),
	endTime: z.string().datetime().optional(),
	duration: z.number().int().positive().optional(), // in minutes
	settings: z
		.object({
			enableProctoring: z.boolean().default(true),
			allowLateSubmission: z.boolean().default(false),
			shuffleQuestions: z.boolean().default(false),
			showResults: z.boolean().default(true),
		})
		.optional(),
});

export type CreateExamInput = z.infer<typeof createExamSchema>;

// Update exam schema
export const updateExamSchema = createExamSchema.partial();

export type UpdateExamInput = z.infer<typeof updateExamSchema>;

// Add questions to exam schema
export const addQuestionsSchema = z.object({
	questions: z
		.array(
			z.object({
				questionId: z.string().uuid(),
				order: z.number().int().nonnegative().optional(),
				points: z.number().positive().optional(),
			}),
		)
		.min(1, "At least one question is required"),
});

export type AddQuestionsInput = z.infer<typeof addQuestionsSchema>;

// Submit answer schema
export const submitAnswerSchema = z.object({
	questionId: z.string().uuid(),
	answerText: z.string().optional(),
	answerFileUrl: z.string().url().optional(),
});

export type SubmitAnswerInput = z.infer<typeof submitAnswerSchema>;

// Batch submit answers schema
export const batchSubmitAnswersSchema = z.object({
	answers: z.array(submitAnswerSchema).min(1),
});

export type BatchSubmitAnswersInput = z.infer<typeof batchSubmitAnswersSchema>;

// List exams query schema
export const listExamsQuerySchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(50).default(20),
	status: z.enum(["DRAFT", "ONGOING", "FINISHED"]).optional(),
	search: z.string().optional(),
});

export type ListExamsQuery = z.infer<typeof listExamsQuerySchema>;

// Create question schema (for embedding questions directly)
export const createQuestionSchema = z.object({
	type: z.enum(["PG", "ESSAY"]),
	question: z.string().min(1, "Question text is required"),
	options: z.record(z.string()).optional(), // for PG: { A: "...", B: "...", etc. }
	answerKey: z.string().optional(),
	rubric: z.record(z.number()).optional(),
	difficulty: z.enum(["mudah", "sedang", "sulit"]).optional(),
	category: z.string().optional(),
	isHots: z.boolean().default(false),
});

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;

// Update question schema
export const updateQuestionSchema = createQuestionSchema.partial();

export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;

// List questions query schema
export const listQuestionsQuerySchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(100).default(20),
	type: z.enum(["PG", "ESSAY"]).optional(),
	difficulty: z.enum(["mudah", "sedang", "sulit"]).optional(),
	search: z.string().optional(),
});

export type ListQuestionsQuery = z.infer<typeof listQuestionsQuerySchema>;
