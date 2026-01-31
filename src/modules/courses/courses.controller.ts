import type { Context } from "hono";
import { coursesService } from "./courses.service";
import { listCoursesQuerySchema } from "./courses.schema";
import type { AppVariables } from "../../types";

export const coursesController = {
	// GET /courses/materials
	async listMaterials(c: Context<{ Variables: AppVariables }>) {
		const queryParams = c.req.query();
		const query = listCoursesQuerySchema.parse(queryParams);

		const result = await coursesService.listMaterials(query);

		return c.json({
			success: true,
			data: result.data,
			pagination: result.pagination,
		});
	},

	// GET /courses/materials/:id
	async getMaterial(c: Context<{ Variables: AppVariables }>) {
		const materialId = c.req.param("id");

		const material = await coursesService.getMaterial(materialId);

		return c.json({
			success: true,
			data: material,
		});
	},
};
