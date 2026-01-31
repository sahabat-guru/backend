import { z } from "zod";

// Update profile schema
export const updateProfileSchema = z.object({
	name: z
		.string()
		.min(2, "Name must be at least 2 characters")
		.max(100)
		.optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// Query params for listing users (admin only - future use)
export const listUsersQuerySchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(100).default(20),
	role: z.enum(["GURU", "MURID"]).optional(),
	search: z.string().optional(),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
