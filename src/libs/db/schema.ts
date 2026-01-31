import {
	pgTable,
	uuid,
	text,
	timestamp,
	boolean,
	doublePrecision,
	integer,
	jsonb,
	pgEnum,
	primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const roleEnum = pgEnum("role", ["GURU", "MURID"]);
export const materialTypeEnum = pgEnum("material_type", [
	"PPT",
	"RPP",
	"LKPD",
	"QUESTIONS",
]);
export const questionTypeEnum = pgEnum("question_type", ["PG", "ESSAY"]);
export const examStatusEnum = pgEnum("exam_status", [
	"DRAFT",
	"ONGOING",
	"FINISHED",
]);
export const answerStatusEnum = pgEnum("answer_status", ["PENDING", "SCORED"]);
export const proctoringEventTypeEnum = pgEnum("proctoring_event_type", [
	"HEAD_POSE",
	"EYE_GAZE",
	"OBJECT",
	"LIP",
	"MULTI_FACE",
	"FACE_ABSENT",
]);

// Users Table
export const users = pgTable("users", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: text("name").notNull(),
	email: text("email").unique().notNull(),
	passwordHash: text("password_hash").notNull(),
	role: roleEnum("role").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
});

// Materials Table
export const materials = pgTable("materials", {
	id: uuid("id").primaryKey().defaultRandom(),
	teacherId: uuid("teacher_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	type: materialTypeEnum("type").notNull(),
	title: text("title").notNull(),
	contentJson: jsonb("content_json"),
	fileUrl: text("file_url"),
	previewUrl: text("preview_url"),
	isPublished: boolean("is_published").default(false).notNull(),
	metadata: jsonb("metadata"), // Store additional info like template, jenjang, etc.
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
});

// Questions Table
export const questions = pgTable("questions", {
	id: uuid("id").primaryKey().defaultRandom(),
	teacherId: uuid("teacher_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	type: questionTypeEnum("type").notNull(),
	question: text("question").notNull(),
	options: jsonb("options"), // For multiple choice
	answerKey: text("answer_key"),
	rubric: jsonb("rubric"),
	difficulty: text("difficulty"), // mudah, sedang, sulit
	category: text("category"), // kategori bloom
	isHots: boolean("is_hots").default(false),
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
});

// Exams Table
export const exams = pgTable("exams", {
	id: uuid("id").primaryKey().defaultRandom(),
	teacherId: uuid("teacher_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	title: text("title").notNull(),
	description: text("description"),
	startTime: timestamp("start_time", { withTimezone: true }),
	endTime: timestamp("end_time", { withTimezone: true }),
	duration: integer("duration"), // in minutes
	status: examStatusEnum("status").default("DRAFT").notNull(),
	settings: jsonb("settings"), // proctoring settings, etc.
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
});

// Exam Questions Junction Table
export const examQuestions = pgTable(
	"exam_questions",
	{
		examId: uuid("exam_id")
			.notNull()
			.references(() => exams.id, { onDelete: "cascade" }),
		questionId: uuid("question_id")
			.notNull()
			.references(() => questions.id, { onDelete: "cascade" }),
		order: integer("order").default(0),
		points: doublePrecision("points").default(1),
	},
	(t) => ({
		pk: primaryKey({ columns: [t.examId, t.questionId] }),
	}),
);

// Exam Participants Table
export const examParticipants = pgTable("exam_participants", {
	id: uuid("id").primaryKey().defaultRandom(),
	examId: uuid("exam_id")
		.notNull()
		.references(() => exams.id, { onDelete: "cascade" }),
	studentId: uuid("student_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	proctoringSessionId: text("proctoring_session_id"), // From external proctoring service
	startTime: timestamp("start_time", { withTimezone: true }),
	submitTime: timestamp("submit_time", { withTimezone: true }),
	score: doublePrecision("score"),
	status: text("status").default("JOINED"), // JOINED, IN_PROGRESS, SUBMITTED, SCORED
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
});

// Answers Table
export const answers = pgTable("answers", {
	id: uuid("id").primaryKey().defaultRandom(),
	participantId: uuid("participant_id")
		.notNull()
		.references(() => examParticipants.id, { onDelete: "cascade" }),
	questionId: uuid("question_id")
		.notNull()
		.references(() => questions.id, { onDelete: "cascade" }),
	answerText: text("answer_text"),
	answerFileUrl: text("answer_file_url"),
	aiScore: doublePrecision("ai_score"),
	finalScore: doublePrecision("final_score"),
	feedback: text("feedback"),
	status: answerStatusEnum("status").default("PENDING").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
});

// Proctoring Logs Table
export const proctoringLogs = pgTable("proctoring_logs", {
	id: uuid("id").primaryKey().defaultRandom(),
	examId: uuid("exam_id")
		.notNull()
		.references(() => exams.id, { onDelete: "cascade" }),
	studentId: uuid("student_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	participantId: uuid("participant_id").references(
		() => examParticipants.id,
		{ onDelete: "cascade" },
	),
	eventType: proctoringEventTypeEnum("event_type").notNull(),
	confidence: doublePrecision("confidence"),
	details: jsonb("details"),
	snapshotUrl: text("snapshot_url"),
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
});

// Exam Statistics Table
export const examStatistics = pgTable("exam_statistics", {
	examId: uuid("exam_id")
		.primaryKey()
		.references(() => exams.id, { onDelete: "cascade" }),
	avgScore: doublePrecision("avg_score"),
	maxScore: doublePrecision("max_score"),
	minScore: doublePrecision("min_score"),
	totalParticipants: integer("total_participants").default(0),
	submittedCount: integer("submitted_count").default(0),
	scoredCount: integer("scored_count").default(0),
	suspiciousCount: integer("suspicious_count").default(0),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
});

// Refresh Tokens Table (for JWT refresh token management)
export const refreshTokens = pgTable("refresh_tokens", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	token: text("token").notNull().unique(),
	expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
	materials: many(materials),
	questions: many(questions),
	exams: many(exams),
	examParticipations: many(examParticipants),
	proctoringLogs: many(proctoringLogs),
	refreshTokens: many(refreshTokens),
}));

export const materialsRelations = relations(materials, ({ one }) => ({
	teacher: one(users, {
		fields: [materials.teacherId],
		references: [users.id],
	}),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
	teacher: one(users, {
		fields: [questions.teacherId],
		references: [users.id],
	}),
	examQuestions: many(examQuestions),
	answers: many(answers),
}));

export const examsRelations = relations(exams, ({ one, many }) => ({
	teacher: one(users, {
		fields: [exams.teacherId],
		references: [users.id],
	}),
	examQuestions: many(examQuestions),
	participants: many(examParticipants),
	proctoringLogs: many(proctoringLogs),
	statistics: one(examStatistics, {
		fields: [exams.id],
		references: [examStatistics.examId],
	}),
}));

export const examQuestionsRelations = relations(examQuestions, ({ one }) => ({
	exam: one(exams, {
		fields: [examQuestions.examId],
		references: [exams.id],
	}),
	question: one(questions, {
		fields: [examQuestions.questionId],
		references: [questions.id],
	}),
}));

export const examParticipantsRelations = relations(
	examParticipants,
	({ one, many }) => ({
		exam: one(exams, {
			fields: [examParticipants.examId],
			references: [exams.id],
		}),
		student: one(users, {
			fields: [examParticipants.studentId],
			references: [users.id],
		}),
		answers: many(answers),
		proctoringLogs: many(proctoringLogs),
	}),
);

export const answersRelations = relations(answers, ({ one }) => ({
	participant: one(examParticipants, {
		fields: [answers.participantId],
		references: [examParticipants.id],
	}),
	question: one(questions, {
		fields: [answers.questionId],
		references: [questions.id],
	}),
}));

export const proctoringLogsRelations = relations(proctoringLogs, ({ one }) => ({
	exam: one(exams, {
		fields: [proctoringLogs.examId],
		references: [exams.id],
	}),
	student: one(users, {
		fields: [proctoringLogs.studentId],
		references: [users.id],
	}),
	participant: one(examParticipants, {
		fields: [proctoringLogs.participantId],
		references: [examParticipants.id],
	}),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
	user: one(users, {
		fields: [refreshTokens.userId],
		references: [users.id],
	}),
}));

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Material = typeof materials.$inferSelect;
export type NewMaterial = typeof materials.$inferInsert;
export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;
export type Exam = typeof exams.$inferSelect;
export type NewExam = typeof exams.$inferInsert;
export type ExamQuestion = typeof examQuestions.$inferSelect;
export type ExamParticipant = typeof examParticipants.$inferSelect;
export type NewExamParticipant = typeof examParticipants.$inferInsert;
export type Answer = typeof answers.$inferSelect;
export type NewAnswer = typeof answers.$inferInsert;
export type ProctoringLog = typeof proctoringLogs.$inferSelect;
export type NewProctoringLog = typeof proctoringLogs.$inferInsert;
export type ExamStatistic = typeof examStatistics.$inferSelect;
export type RefreshToken = typeof refreshTokens.$inferSelect;
