import { materialsRepository } from "../materials/materials.repository";
import {
	NotFoundError,
	ForbiddenError,
} from "../../middlewares/error.middleware";
import type { ListCoursesQuery } from "./courses.schema";

export const coursesService = {
	// List published materials (for students)
	async listMaterials(query: ListCoursesQuery) {
		return materialsRepository.listPublished({
			...query,
			isPublished: true,
		});
	},

	// Get specific published material
	async getMaterial(materialId: string) {
		const material = await materialsRepository.findById(materialId);

		if (!material) {
			throw new NotFoundError("Material");
		}

		if (!material.isPublished) {
			throw new ForbiddenError("This material is not available");
		}

		return material;
	},
};
