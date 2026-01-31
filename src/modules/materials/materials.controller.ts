import type { Context } from "hono";
import { materialsService } from "./materials.service";
import {
	generateMaterialSchema,
	updateMaterialSchema,
	listMaterialsQuerySchema,
} from "./materials.schema";
import type { AppVariables } from "../../types";
import { Role } from "../../types";

export const materialsController = {
	// POST /materials/generate
	async generateMaterial(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");
		const body = await c.req.json();
		const input = generateMaterialSchema.parse(body);

		const material = await materialsService.generateMaterial(
			user.sub,
			input,
		);

		return c.json(
			{
				success: true,
				data: material,
				message: "Material generated successfully",
			},
			201,
		);
	},

	// GET /materials
	async listMaterials(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");
		const queryParams = c.req.query();
		const query = listMaterialsQuerySchema.parse(queryParams);

		// If user is a student, only return published materials
		if (user.role === Role.MURID) {
			const result = await materialsService.listPublishedMaterials(query);
			return c.json({
				success: true,
				data: result.data,
				pagination: result.pagination,
			});
		}

		// If user is a teacher, return their materials
		const result = await materialsService.listMaterials(user.sub, query);

		return c.json({
			success: true,
			data: result.data,
			pagination: result.pagination,
		});
	},

	// GET /materials/templates
	async getTemplates(c: Context) {
		const templates = await materialsService.getTemplates();

		return c.json({
			success: true,
			data: templates,
		});
	},

	// GET /materials/:id
	async getMaterial(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");
		const materialId = c.req.param("id");
		const isTeacher = user.role === Role.GURU;

		const material = await materialsService.getMaterial(
			materialId,
			user.sub,
			isTeacher,
		);

		return c.json({
			success: true,
			data: material,
		});
	},

	// PUT /materials/:id
	async updateMaterial(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");
		const materialId = c.req.param("id");
		const body = await c.req.json();
		const input = updateMaterialSchema.parse(body);

		const material = await materialsService.updateMaterial(
			materialId,
			user.sub,
			input,
		);

		return c.json({
			success: true,
			data: material,
			message: "Material updated successfully",
		});
	},

	// POST /materials/:id/publish
	async publishMaterial(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");
		const materialId = c.req.param("id");

		const material = await materialsService.publishMaterial(
			materialId,
			user.sub,
		);

		return c.json({
			success: true,
			data: material,
			message: "Material published successfully",
		});
	},

	// POST /materials/:id/unpublish
	async unpublishMaterial(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");
		const materialId = c.req.param("id");

		const material = await materialsService.unpublishMaterial(
			materialId,
			user.sub,
		);

		return c.json({
			success: true,
			data: material,
			message: "Material unpublished successfully",
		});
	},

	// DELETE /materials/:id
	async deleteMaterial(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");
		const materialId = c.req.param("id");

		await materialsService.deleteMaterial(materialId, user.sub);

		return c.json({
			success: true,
			message: "Material deleted successfully",
		});
	},

	// POST /materials/:id/create-exam
	async createExamFromMaterial(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");
		const materialId = c.req.param("id");

		const exam = await materialsService.createExamFromMaterial(
			materialId,
			user.sub,
		);

		return c.json(
			{
				success: true,
				data: exam,
				message: "Exam created from material successfully",
			},
			201,
		);
	},
};
