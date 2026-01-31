import { materialsRepository } from "./materials.repository";
import { materialGeneratorService } from "../../services/material-generator.service";
import {
	NotFoundError,
	ForbiddenError,
} from "../../middlewares/error.middleware";
import { logger } from "../../libs/config";
import type {
	GenerateMaterialInput,
	GeneratePPTInput,
	GenerateRPPInput,
	GenerateLKPDInput,
	GenerateQuestionsInput,
	UpdateMaterialInput,
	ListMaterialsQuery,
} from "./materials.schema";
import { MaterialType } from "../../types";

export const materialsService = {
	// Generate material based on type
	async generateMaterial(teacherId: string, input: GenerateMaterialInput) {
		let result;
		let title: string;
		let contentJson: unknown;
		let fileUrl: string | undefined;
		let previewUrl: string | undefined;
		let metadata: Record<string, unknown>;

		switch (input.type) {
			case "PPT": {
				const pptInput = input as GeneratePPTInput;
				result = await materialGeneratorService.generatePPT({
					template: pptInput.template,
					topic: pptInput.topic,
					kurikulum: pptInput.kurikulum,
					jenjang: pptInput.jenjang,
					detail_level: pptInput.detail_level,
					include_examples: pptInput.include_examples,
				});
				title = `PPT - ${pptInput.topic}`;
				fileUrl = result.url;
				previewUrl = result.preview_url;
				contentJson = {
					total_slides: result.total_slides,
					template_used: result.template_used,
				};
				metadata = {
					template: pptInput.template,
					kurikulum: pptInput.kurikulum,
					jenjang: pptInput.jenjang,
					detail_level: pptInput.detail_level,
				};
				break;
			}

			case "RPP": {
				const rppInput = input as GenerateRPPInput;
				result = await materialGeneratorService.generateRPP({
					topic: rppInput.topic,
					kurikulum: rppInput.kurikulum,
					jenjang: rppInput.jenjang,
					tujuan_pembelajaran: rppInput.tujuan_pembelajaran,
					karakteristik_siswa: rppInput.karakteristik_siswa || "",
					alokasi_waktu: rppInput.alokasi_waktu,
				});
				title = `RPP - ${rppInput.topic}`;
				fileUrl = result.url;
				previewUrl = result.preview_url;
				contentJson = {};
				metadata = {
					kurikulum: rppInput.kurikulum,
					jenjang: rppInput.jenjang,
					tujuan_pembelajaran: rppInput.tujuan_pembelajaran,
					alokasi_waktu: rppInput.alokasi_waktu,
				};
				break;
			}

			case "LKPD": {
				const lkpdInput = input as GenerateLKPDInput;
				result = await materialGeneratorService.generateLKPD({
					topik_lkpd: lkpdInput.topik_lkpd,
					kurikulum: lkpdInput.kurikulum,
					jenjang: lkpdInput.jenjang,
					mata_pelajaran: lkpdInput.mata_pelajaran,
					kelas: lkpdInput.kelas,
					jenis_lkpd: lkpdInput.jenis_lkpd,
					fitur_tambahan: lkpdInput.fitur_tambahan,
				});
				title = `LKPD - ${lkpdInput.topik_lkpd}`;
				fileUrl = result.url;
				previewUrl = result.preview_url;
				contentJson = {
					jenis_lkpd: result.jenis_lkpd,
				};
				metadata = {
					kurikulum: lkpdInput.kurikulum,
					jenjang: lkpdInput.jenjang,
					mata_pelajaran: lkpdInput.mata_pelajaran,
					kelas: lkpdInput.kelas,
					jenis_lkpd: lkpdInput.jenis_lkpd,
				};
				break;
			}

			case "QUESTIONS": {
				const questionsInput = input as GenerateQuestionsInput;
				result = await materialGeneratorService.generateQuestions({
					topic: questionsInput.topic,
					jenjang: questionsInput.jenjang,
					jumlah_soal: questionsInput.jumlah_soal,
					tipe_soal: questionsInput.tipe_soal,
					tingkat_kesulitan: questionsInput.tingkat_kesulitan,
					include_hots: questionsInput.include_hots,
				});
				title = `Soal - ${questionsInput.topic}`;
				fileUrl = result.url;
				previewUrl = result.preview_url;
				contentJson = {
					jumlah_soal: result.jumlah_soal,
					questions: result.content,
				};
				metadata = {
					jenjang: questionsInput.jenjang,
					tipe_soal: questionsInput.tipe_soal,
					tingkat_kesulitan: questionsInput.tingkat_kesulitan,
					include_hots: questionsInput.include_hots,
				};
				break;
			}
		}

		// Save to database
		const material = await materialsRepository.create({
			teacherId,
			type: input.type as MaterialType,
			title,
			contentJson,
			fileUrl,
			previewUrl,
			metadata,
			isPublished: false,
		});

		logger.info(
			{ type: input.type, teacherId },
			`Material generated: ${material.id}`,
		);

		return material;
	},

	// Get material by ID
	async getMaterial(materialId: string, userId: string, isTeacher: boolean) {
		const material = await materialsRepository.findById(materialId);

		if (!material) {
			throw new NotFoundError("Material");
		}

		// Students can only see published materials
		if (!isTeacher && !material.isPublished) {
			throw new ForbiddenError("This material is not published");
		}

		// Teachers can only see their own materials
		if (isTeacher && material.teacherId !== userId) {
			throw new ForbiddenError("You do not have access to this material");
		}

		return material;
	},

	// List materials for teacher
	async listMaterials(teacherId: string, query: ListMaterialsQuery) {
		return materialsRepository.listByTeacher(teacherId, query);
	},

	// Update material
	async updateMaterial(
		materialId: string,
		teacherId: string,
		input: UpdateMaterialInput,
	) {
		const material = await materialsRepository.findByIdAndTeacher(
			materialId,
			teacherId,
		);

		if (!material) {
			throw new NotFoundError("Material");
		}

		const updated = await materialsRepository.update(materialId, input);

		logger.info(`Material updated: ${materialId}`);

		return updated;
	},

	// Publish material
	async publishMaterial(materialId: string, teacherId: string) {
		const material = await materialsRepository.findByIdAndTeacher(
			materialId,
			teacherId,
		);

		if (!material) {
			throw new NotFoundError("Material");
		}

		const updated = await materialsRepository.update(materialId, {
			isPublished: true,
		});

		logger.info(`Material published: ${materialId}`);

		return updated;
	},

	// Unpublish material
	async unpublishMaterial(materialId: string, teacherId: string) {
		const material = await materialsRepository.findByIdAndTeacher(
			materialId,
			teacherId,
		);

		if (!material) {
			throw new NotFoundError("Material");
		}

		const updated = await materialsRepository.update(materialId, {
			isPublished: false,
		});

		logger.info(`Material unpublished: ${materialId}`);

		return updated;
	},

	// Delete material
	async deleteMaterial(materialId: string, teacherId: string) {
		const material = await materialsRepository.findByIdAndTeacher(
			materialId,
			teacherId,
		);

		if (!material) {
			throw new NotFoundError("Material");
		}

		await materialsRepository.delete(materialId);

		logger.info(`Material deleted: ${materialId}`);

		return { success: true };
	},

	// Get templates
	async getTemplates() {
		return materialGeneratorService.getTemplates();
	},
};
