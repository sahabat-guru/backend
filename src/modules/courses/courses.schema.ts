import { z } from "zod";
import { MaterialType } from "../../types";

// List courses query schema
export const listCoursesQuerySchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(50).default(20),
	type: z.nativeEnum(MaterialType).optional(),
	search: z.string().optional(),
});

export type ListCoursesQuery = z.infer<typeof listCoursesQuerySchema>;
