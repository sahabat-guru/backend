import { eq, and, sql, desc, inArray } from "drizzle-orm";
import { db } from "../../libs/db";
import {
	exams,
	examQuestions,
	examParticipants,
	answers,
	questions,
	examStatistics,
} from "../../libs/db/schema";
import type {
	Exam,
	NewExam,
	ExamParticipant,
	NewExamParticipant,
	Answer,
	NewAnswer,
	Question,
	NewQuestion,
	ExamStatistic,
} from "../../libs/db/schema";
import type { ListExamsQuery, ListQuestionsQuery } from "./exams.schema";

export const examsRepository = {
	// === EXAMS ===

	// Create exam
	async createExam(data: NewExam): Promise<Exam> {
		const [created] = await db.insert(exams).values(data).returning();
		return created;
	},

	// Find exam by ID
	async findExamById(id: string): Promise<Exam | undefined> {
		return db.query.exams.findFirst({
			where: eq(exams.id, id),
		});
	},

	// Find exam by ID with teacher check
	async findExamByIdAndTeacher(
		id: string,
		teacherId: string,
	): Promise<Exam | undefined> {
		return db.query.exams.findFirst({
			where: and(eq(exams.id, id), eq(exams.teacherId, teacherId)),
		});
	},

	// Find exam with questions
	async findExamWithQuestions(id: string) {
		return db.query.exams.findFirst({
			where: eq(exams.id, id),
			with: {
				examQuestions: {
					with: {
						question: true,
					},
					orderBy: (eq, { asc }) => [asc(eq.order)],
				},
			},
		});
	},

	// Update exam
	async updateExam(
		id: string,
		data: Partial<Exam>,
	): Promise<Exam | undefined> {
		const [updated] = await db
			.update(exams)
			.set({
				...data,
				updatedAt: new Date(),
			})
			.where(eq(exams.id, id))
			.returning();

		return updated;
	},

	// Delete exam
	async deleteExam(id: string): Promise<boolean> {
		const result = await db
			.delete(exams)
			.where(eq(exams.id, id))
			.returning();
		return result.length > 0;
	},

	// List exams by teacher
	async listExamsByTeacher(teacherId: string, query: ListExamsQuery) {
		const { page, limit, status, search } = query;
		const offset = (page - 1) * limit;

		const conditions = [eq(exams.teacherId, teacherId)];

		if (status) {
			conditions.push(eq(exams.status, status));
		}

		if (search) {
			conditions.push(sql`${exams.title} ILIKE ${`%${search}%`}`);
		}

		const whereClause = and(...conditions);

		const [data, countResult] = await Promise.all([
			db.query.exams.findMany({
				where: whereClause,
				limit,
				offset,
				orderBy: [desc(exams.createdAt)],
				with: {
					statistics: true,
				},
			}),
			db
				.select({ count: sql<number>`count(*)` })
				.from(exams)
				.where(whereClause),
		]);

		const total = Number(countResult[0]?.count || 0);

		return {
			data,
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		};
	},

	// List available exams for students
	async listAvailableExams(query: ListExamsQuery) {
		const { page, limit, search } = query;
		const offset = (page - 1) * limit;

		const conditions = [eq(exams.status, "ONGOING")];

		if (search) {
			conditions.push(sql`${exams.title} ILIKE ${`%${search}%`}`);
		}

		const whereClause = and(...conditions);

		const [data, countResult] = await Promise.all([
			db.query.exams.findMany({
				where: whereClause,
				limit,
				offset,
				orderBy: [desc(exams.startTime)],
				with: {
					teacher: {
						columns: {
							id: true,
							name: true,
						},
					},
				},
			}),
			db
				.select({ count: sql<number>`count(*)` })
				.from(exams)
				.where(whereClause),
		]);

		const total = Number(countResult[0]?.count || 0);

		return {
			data,
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		};
	},

	// === EXAM QUESTIONS ===

	// Add questions to exam
	async addQuestionsToExam(
		examId: string,
		questionData: { questionId: string; order?: number; points?: number }[],
	) {
		const values = questionData.map((q, index) => ({
			examId,
			questionId: q.questionId,
			order: q.order ?? index,
			points: q.points ?? 1,
		}));

		await db.insert(examQuestions).values(values).onConflictDoNothing();
	},

	// Remove question from exam
	async removeQuestionFromExam(examId: string, questionId: string) {
		await db
			.delete(examQuestions)
			.where(
				and(
					eq(examQuestions.examId, examId),
					eq(examQuestions.questionId, questionId),
				),
			);
	},

	// Get exam questions
	async getExamQuestions(examId: string) {
		return db.query.examQuestions.findMany({
			where: eq(examQuestions.examId, examId),
			with: {
				question: true,
			},
			orderBy: (eq, { asc }) => [asc(eq.order)],
		});
	},

	// === EXAM PARTICIPANTS ===

	// Create participant
	async createParticipant(
		data: NewExamParticipant,
	): Promise<ExamParticipant> {
		const [created] = await db
			.insert(examParticipants)
			.values(data)
			.returning();
		return created;
	},

	// Find participant
	async findParticipant(
		examId: string,
		studentId: string,
	): Promise<ExamParticipant | undefined> {
		return db.query.examParticipants.findFirst({
			where: and(
				eq(examParticipants.examId, examId),
				eq(examParticipants.studentId, studentId),
			),
		});
	},

	// Find participant by ID
	async findParticipantById(
		id: string,
	): Promise<ExamParticipant | undefined> {
		return db.query.examParticipants.findFirst({
			where: eq(examParticipants.id, id),
		});
	},

	// Update participant
	async updateParticipant(
		id: string,
		data: Partial<ExamParticipant>,
	): Promise<ExamParticipant | undefined> {
		const [updated] = await db
			.update(examParticipants)
			.set(data)
			.where(eq(examParticipants.id, id))
			.returning();

		return updated;
	},

	// List participants for exam
	async listParticipants(examId: string) {
		return db.query.examParticipants.findMany({
			where: eq(examParticipants.examId, examId),
			with: {
				student: {
					columns: {
						id: true,
						name: true,
						email: true,
					},
				},
				answers: true,
			},
		});
	},

	// Get student's exams
	async getStudentExams(studentId: string) {
		return db.query.examParticipants.findMany({
			where: eq(examParticipants.studentId, studentId),
			with: {
				exam: {
					with: {
						teacher: {
							columns: {
								id: true,
								name: true,
							},
						},
					},
				},
			},
			orderBy: [desc(examParticipants.createdAt)],
		});
	},

	// List student exam history with optional status filter
	async listStudentExamHistory(
		studentId: string,
		status?: "ONGOING" | "FINISHED" | "PUBLISHED",
	) {
		const participations = await db.query.examParticipants.findMany({
			where: eq(examParticipants.studentId, studentId),
			with: {
				exam: {
					with: {
						teacher: {
							columns: {
								id: true,
								name: true,
							},
						},
						statistics: true,
					},
				},
				answers: true,
			},
			orderBy: [desc(examParticipants.createdAt)],
		});

		// Filter by exam status if provided
		if (status) {
			return participations.filter((p) => p.exam.status === status);
		}

		return participations;
	},

	// === ANSWERS ===

	// Create or update answer
	async upsertAnswer(
		participantId: string,
		questionId: string,
		data: Partial<NewAnswer>,
	): Promise<Answer> {
		const existing = await db.query.answers.findFirst({
			where: and(
				eq(answers.participantId, participantId),
				eq(answers.questionId, questionId),
			),
		});

		if (existing) {
			const [updated] = await db
				.update(answers)
				.set({
					...data,
					updatedAt: new Date(),
				})
				.where(eq(answers.id, existing.id))
				.returning();
			return updated;
		}

		const [created] = await db
			.insert(answers)
			.values({
				participantId,
				questionId,
				...data,
			})
			.returning();

		return created;
	},

	// Get answers for participant
	async getParticipantAnswers(participantId: string) {
		return db.query.answers.findMany({
			where: eq(answers.participantId, participantId),
			with: {
				question: true,
			},
		});
	},

	// Update answer score
	async updateAnswerScore(
		answerId: string,
		aiScore: number | null,
		finalScore: number | null,
	) {
		const [updated] = await db
			.update(answers)
			.set({
				aiScore,
				finalScore,
				status: "SCORED",
				updatedAt: new Date(),
			})
			.where(eq(answers.id, answerId))
			.returning();

		return updated;
	},

	// === QUESTIONS ===

	// Create question
	async createQuestion(data: NewQuestion): Promise<Question> {
		const [created] = await db.insert(questions).values(data).returning();
		return created;
	},

	// Find question by ID
	async findQuestionById(id: string): Promise<Question | undefined> {
		return db.query.questions.findFirst({
			where: eq(questions.id, id),
		});
	},

	// Find question by ID and teacher
	async findQuestionByIdAndTeacher(
		id: string,
		teacherId: string,
	): Promise<Question | undefined> {
		return db.query.questions.findFirst({
			where: and(
				eq(questions.id, id),
				eq(questions.teacherId, teacherId),
			),
		});
	},

	// Update question
	async updateQuestion(
		id: string,
		data: Partial<Question>,
	): Promise<Question | undefined> {
		const [updated] = await db
			.update(questions)
			.set({
				...data,
				updatedAt: new Date(),
			})
			.where(eq(questions.id, id))
			.returning();

		return updated;
	},

	// Delete question
	async deleteQuestion(id: string): Promise<boolean> {
		const result = await db
			.delete(questions)
			.where(eq(questions.id, id))
			.returning();
		return result.length > 0;
	},

	// List questions by teacher
	async listQuestionsByTeacher(teacherId: string, query: ListQuestionsQuery) {
		const { page, limit, type, difficulty, search } = query;
		const offset = (page - 1) * limit;

		const conditions = [eq(questions.teacherId, teacherId)];

		if (type) {
			conditions.push(eq(questions.type, type));
		}

		if (difficulty) {
			conditions.push(eq(questions.difficulty, difficulty));
		}

		if (search) {
			conditions.push(sql`${questions.question} ILIKE ${`%${search}%`}`);
		}

		const whereClause = and(...conditions);

		const [data, countResult] = await Promise.all([
			db.query.questions.findMany({
				where: whereClause,
				limit,
				offset,
				orderBy: [desc(questions.createdAt)],
			}),
			db
				.select({ count: sql<number>`count(*)` })
				.from(questions)
				.where(whereClause),
		]);

		const total = Number(countResult[0]?.count || 0);

		return {
			data,
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		};
	},

	// === STATISTICS ===

	// Create or update exam statistics
	async upsertStatistics(examId: string, data: Partial<ExamStatistic>) {
		const existing = await db.query.examStatistics.findFirst({
			where: eq(examStatistics.examId, examId),
		});

		if (existing) {
			const [updated] = await db
				.update(examStatistics)
				.set({
					...data,
					updatedAt: new Date(),
				})
				.where(eq(examStatistics.examId, examId))
				.returning();
			return updated;
		}

		const [created] = await db
			.insert(examStatistics)
			.values({
				examId,
				...data,
			})
			.returning();

		return created;
	},

	// Get exam statistics
	async getStatistics(examId: string) {
		return db.query.examStatistics.findFirst({
			where: eq(examStatistics.examId, examId),
		});
	},
};
