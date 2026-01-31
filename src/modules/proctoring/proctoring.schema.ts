import { z } from "zod";

// Report proctoring event schema
export const reportEventSchema = z.object({
	sessionId: z.string().min(1),
	eventType: z.enum([
		"HEAD_POSE",
		"EYE_GAZE",
		"OBJECT",
		"LIP",
		"MULTI_FACE",
		"FACE_ABSENT",
	]),
	confidence: z.number().min(0).max(1).optional(),
	details: z.record(z.unknown()).optional(),
	snapshotUrl: z.string().url().optional(),
});

export type ReportEventInput = z.infer<typeof reportEventSchema>;

// Browser event schema
export const browserEventSchema = z.object({
	sessionId: z.string().min(1),
	eventType: z.string().min(1),
	details: z.record(z.unknown()).optional(),
});

export type BrowserEventInput = z.infer<typeof browserEventSchema>;

// List proctoring logs query schema
export const listLogsQuerySchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(100).default(50),
	eventType: z
		.enum([
			"HEAD_POSE",
			"EYE_GAZE",
			"OBJECT",
			"LIP",
			"MULTI_FACE",
			"FACE_ABSENT",
		])
		.optional(),
	studentId: z.string().uuid().optional(),
});

export type ListLogsQuery = z.infer<typeof listLogsQuerySchema>;
