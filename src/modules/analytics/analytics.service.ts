import { eq, and, sql, gte, lte, desc } from "drizzle-orm";
import { db } from "../../libs/db";
import {
	exams,
	examParticipants,
	examStatistics,
	materials,
	questions,
	proctoringLogs,
	users,
} from "../../libs/db/schema";
import { examsRepository } from "../exams/exams.repository";
import { NotFoundError } from "../../middlewares/error.middleware";
import { logger } from "../../libs/config";
import type { AnalyticsQuery } from "./analytics.schema";

export const analyticsService = {
	// Get exam analytics
	async getExamAnalytics(examId: string, teacherId: string) {
		const exam = await examsRepository.findExamByIdAndTeacher(
			examId,
			teacherId,
		);

		if (!exam) {
			throw new NotFoundError("Exam");
		}

		// Get statistics
		const stats = await examsRepository.getStatistics(examId);

		// Get participants with scores
		const participants = await examsRepository.listParticipants(examId);

		// Score distribution (buckets of 10)
		const scoreDistribution: Record<string, number> = {
			"0-10": 0,
			"11-20": 0,
			"21-30": 0,
			"31-40": 0,
			"41-50": 0,
			"51-60": 0,
			"61-70": 0,
			"71-80": 0,
			"81-90": 0,
			"91-100": 0,
		};

		const scores = participants
			.filter((p) => p.score !== null)
			.map((p) => p.score as number);

		for (const score of scores) {
			if (score <= 10) scoreDistribution["0-10"]++;
			else if (score <= 20) scoreDistribution["11-20"]++;
			else if (score <= 30) scoreDistribution["21-30"]++;
			else if (score <= 40) scoreDistribution["31-40"]++;
			else if (score <= 50) scoreDistribution["41-50"]++;
			else if (score <= 60) scoreDistribution["51-60"]++;
			else if (score <= 70) scoreDistribution["61-70"]++;
			else if (score <= 80) scoreDistribution["71-80"]++;
			else if (score <= 90) scoreDistribution["81-90"]++;
			else scoreDistribution["91-100"]++;
		}

		// Proctoring summary
		const proctoringStats = await db
			.select({
				eventType: proctoringLogs.eventType,
				count: sql<number>`count(*)`,
			})
			.from(proctoringLogs)
			.where(eq(proctoringLogs.examId, examId))
			.groupBy(proctoringLogs.eventType);

		// Completion rate
		const totalParticipants = participants.length;
		const submittedCount = participants.filter((p) => p.submitTime).length;
		const completionRate =
			totalParticipants > 0
				? (submittedCount / totalParticipants) * 100
				: 0;

		// Average time to complete
		const completionTimes = participants
			.filter((p) => p.startTime && p.submitTime)
			.map((p) => {
				const start = new Date(p.startTime!).getTime();
				const end = new Date(p.submitTime!).getTime();
				return (end - start) / 60000; // in minutes
			});

		const avgCompletionTime =
			completionTimes.length > 0
				? completionTimes.reduce((a, b) => a + b, 0) /
					completionTimes.length
				: 0;

		return {
			exam: {
				id: exam.id,
				title: exam.title,
				status: exam.status,
				startTime: exam.startTime,
				endTime: exam.endTime,
			},
			statistics: {
				avgScore: stats?.avgScore || 0,
				maxScore: stats?.maxScore || 0,
				minScore: stats?.minScore || 0,
				totalParticipants,
				submittedCount,
				scoredCount: stats?.scoredCount || 0,
				completionRate: Math.round(completionRate),
				avgCompletionTime: Math.round(avgCompletionTime),
			},
			scoreDistribution,
			proctoringViolations: proctoringStats,
			suspiciousCount: stats?.suspiciousCount || 0,
		};
	},

	// Get teacher overview analytics
	async getOverviewAnalytics(teacherId: string, query: AnalyticsQuery) {
		// Build date conditions
		const dateConditions = [];
		if (query.startDate) {
			dateConditions.push(
				gte(exams.createdAt, new Date(query.startDate)),
			);
		}
		if (query.endDate) {
			dateConditions.push(lte(exams.createdAt, new Date(query.endDate)));
		}

		const baseCondition = eq(exams.teacherId, teacherId);
		const whereClause =
			dateConditions.length > 0
				? and(baseCondition, ...dateConditions)
				: baseCondition;

		// Total exams
		const [examCount] = await db
			.select({ count: sql<number>`count(*)` })
			.from(exams)
			.where(whereClause);

		// Exams by status
		const examsByStatus = await db
			.select({
				status: exams.status,
				count: sql<number>`count(*)`,
			})
			.from(exams)
			.where(whereClause)
			.groupBy(exams.status);

		// Total materials
		const [materialCount] = await db
			.select({ count: sql<number>`count(*)` })
			.from(materials)
			.where(eq(materials.teacherId, teacherId));

		// Materials by type
		const materialsByType = await db
			.select({
				type: materials.type,
				count: sql<number>`count(*)`,
			})
			.from(materials)
			.where(eq(materials.teacherId, teacherId))
			.groupBy(materials.type);

		// Total questions
		const [questionCount] = await db
			.select({ count: sql<number>`count(*)` })
			.from(questions)
			.where(eq(questions.teacherId, teacherId));

		// Total students who participated in exams
		const teacherExamIds = await db
			.select({ id: exams.id })
			.from(exams)
			.where(eq(exams.teacherId, teacherId));

		const examIdList = teacherExamIds.map((e) => e.id);

		let totalStudents = 0;
		let avgOverallScore = 0;

		if (examIdList.length > 0) {
			const [studentCount] = await db
				.select({
					count: sql<number>`count(distinct ${examParticipants.studentId})`,
				})
				.from(examParticipants)
				.where(sql`${examParticipants.examId} = ANY(${examIdList})`);

			totalStudents = Number(studentCount?.count || 0);

			// Overall average score
			const [avgScore] = await db
				.select({ avg: sql<number>`avg(${examStatistics.avgScore})` })
				.from(examStatistics)
				.where(sql`${examStatistics.examId} = ANY(${examIdList})`);

			avgOverallScore = avgScore?.avg || 0;
		}

		// Recent exams
		const recentExams = await db.query.exams.findMany({
			where: eq(exams.teacherId, teacherId),
			limit: 5,
			orderBy: [desc(exams.createdAt)],
			with: {
				statistics: true,
			},
		});

		return {
			summary: {
				totalExams: Number(examCount?.count || 0),
				totalMaterials: Number(materialCount?.count || 0),
				totalQuestions: Number(questionCount?.count || 0),
				totalStudents,
				avgOverallScore: Math.round(avgOverallScore * 100) / 100,
			},
			examsByStatus: examsByStatus.reduce(
				(acc, item) => {
					acc[item.status] = Number(item.count);
					return acc;
				},
				{} as Record<string, number>,
			),
			materialsByType: materialsByType.reduce(
				(acc, item) => {
					acc[item.type] = Number(item.count);
					return acc;
				},
				{} as Record<string, number>,
			),
			recentExams: recentExams.map((e) => ({
				id: e.id,
				title: e.title,
				status: e.status,
				createdAt: e.createdAt,
				avgScore: e.statistics?.avgScore || 0,
				participantCount: e.statistics?.totalParticipants || 0,
			})),
		};
	},

	// Get student analytics (for a specific student across all exams)
	async getStudentAnalytics(studentId: string, teacherId: string) {
		// Get all exams by this teacher that the student participated in
		const participations = await db.query.examParticipants.findMany({
			where: eq(examParticipants.studentId, studentId),
			with: {
				exam: {
					with: {
						teacher: {
							columns: { id: true },
						},
					},
				},
			},
		});

		// Filter to only this teacher's exams
		const teacherParticipations = participations.filter(
			(p) => p.exam.teacherId === teacherId,
		);

		if (teacherParticipations.length === 0) {
			throw new NotFoundError("Student participation data");
		}

		// Calculate aggregate stats
		const scores = teacherParticipations
			.filter((p) => p.score !== null)
			.map((p) => p.score as number);

		const avgScore =
			scores.length > 0
				? scores.reduce((a, b) => a + b, 0) / scores.length
				: 0;

		// Get proctoring violations
		const [violationCount] = await db
			.select({ count: sql<number>`count(*)` })
			.from(proctoringLogs)
			.where(eq(proctoringLogs.studentId, studentId));

		return {
			totalExams: teacherParticipations.length,
			completedExams: teacherParticipations.filter((p) => p.submitTime)
				.length,
			avgScore: Math.round(avgScore * 100) / 100,
			highestScore: scores.length > 0 ? Math.max(...scores) : 0,
			lowestScore: scores.length > 0 ? Math.min(...scores) : 0,
			totalViolations: Number(violationCount?.count || 0),
			examHistory: teacherParticipations.map((p) => ({
				examId: p.examId,
				examTitle: p.exam.title,
				score: p.score,
				startTime: p.startTime,
				submitTime: p.submitTime,
				status: p.status,
			})),
		};
	},
};
