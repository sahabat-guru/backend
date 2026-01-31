import { eq, and, sql, desc } from "drizzle-orm";
import { db } from "../../libs/db";
import { proctoringLogs, examParticipants, exams } from "../../libs/db/schema";
import type { ProctoringLog, NewProctoringLog } from "../../libs/db/schema";
import type { ListLogsQuery } from "./proctoring.schema";

export const proctoringRepository = {
	// Create proctoring log
	async createLog(data: NewProctoringLog): Promise<ProctoringLog> {
		const [created] = await db
			.insert(proctoringLogs)
			.values(data)
			.returning();
		return created;
	},

	// Get logs by exam
	async getLogsByExam(examId: string, query: ListLogsQuery) {
		const { page, limit, eventType, studentId } = query;
		const offset = (page - 1) * limit;

		const conditions = [eq(proctoringLogs.examId, examId)];

		if (eventType) {
			conditions.push(eq(proctoringLogs.eventType, eventType));
		}

		if (studentId) {
			conditions.push(eq(proctoringLogs.studentId, studentId));
		}

		const whereClause = and(...conditions);

		const [data, countResult] = await Promise.all([
			db.query.proctoringLogs.findMany({
				where: whereClause,
				limit,
				offset,
				orderBy: [desc(proctoringLogs.createdAt)],
				with: {
					student: {
						columns: {
							id: true,
							name: true,
							email: true,
						},
					},
				},
			}),
			db
				.select({ count: sql<number>`count(*)` })
				.from(proctoringLogs)
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

	// Get logs by student for specific exam
	async getLogsByStudent(examId: string, studentId: string) {
		return db.query.proctoringLogs.findMany({
			where: and(
				eq(proctoringLogs.examId, examId),
				eq(proctoringLogs.studentId, studentId),
			),
			orderBy: [desc(proctoringLogs.createdAt)],
		});
	},

	// Count violations by exam
	async countViolationsByExam(examId: string) {
		const result = await db
			.select({
				eventType: proctoringLogs.eventType,
				count: sql<number>`count(*)`,
			})
			.from(proctoringLogs)
			.where(eq(proctoringLogs.examId, examId))
			.groupBy(proctoringLogs.eventType);

		return result;
	},

	// Count violations by student
	async countViolationsByStudent(examId: string, studentId: string) {
		const result = await db
			.select({
				eventType: proctoringLogs.eventType,
				count: sql<number>`count(*)`,
			})
			.from(proctoringLogs)
			.where(
				and(
					eq(proctoringLogs.examId, examId),
					eq(proctoringLogs.studentId, studentId),
				),
			)
			.groupBy(proctoringLogs.eventType);

		return result;
	},

	// Get suspicious students (students with high violation counts)
	async getSuspiciousStudents(examId: string, threshold: number = 5) {
		const result = await db
			.select({
				studentId: proctoringLogs.studentId,
				count: sql<number>`count(*)`,
			})
			.from(proctoringLogs)
			.where(eq(proctoringLogs.examId, examId))
			.groupBy(proctoringLogs.studentId)
			.having(sql`count(*) >= ${threshold}`);

		return result;
	},

	// Get exam proctoring summary
	async getExamProctoringStats(examId: string) {
		const [totalViolations, violationsByType, suspiciousStudents] =
			await Promise.all([
				db
					.select({ count: sql<number>`count(*)` })
					.from(proctoringLogs)
					.where(eq(proctoringLogs.examId, examId)),
				this.countViolationsByExam(examId),
				this.getSuspiciousStudents(examId),
			]);

		return {
			totalViolations: Number(totalViolations[0]?.count || 0),
			violationsByType,
			suspiciousCount: suspiciousStudents.length,
			suspiciousStudents: suspiciousStudents.map((s) => s.studentId),
		};
	},

	// Find participant by session ID
	async findParticipantBySession(sessionId: string) {
		return db.query.examParticipants.findFirst({
			where: eq(examParticipants.proctoringSessionId, sessionId),
			with: {
				exam: true,
				student: {
					columns: {
						id: true,
						name: true,
						email: true,
					},
				},
			},
		});
	},
};
