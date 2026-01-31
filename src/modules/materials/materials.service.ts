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
					kelas: lkpdInput.jenjang || "", // Required by external API, set to same value as jenjang
					mata_pelajaran: lkpdInput.mata_pelajaran,
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

	// Create exam from QUESTIONS material
	async createExamFromMaterial(materialId: string, teacherId: string) {
		const material = await materialsRepository.findByIdAndTeacher(
			materialId,
			teacherId,
		);

		if (!material) {
			throw new NotFoundError("Material");
		}

		if (material.type !== "QUESTIONS") {
			throw new ForbiddenError(
				"Only QUESTIONS materials can be converted to exams",
			);
		}

		const contentJson = material.contentJson as {
			questions?: GeneratedQuestion[];
			jumlah_soal?: number;
		};

		if (!contentJson?.questions?.length) {
			throw new ForbiddenError("Material has no questions");
		}

		// Import examsRepository
		const { examsRepository } = await import("../exams/exams.repository");

		// Create questions in questions table
		const questionIds: string[] = [];
		for (const q of contentJson.questions) {
			// Handle field mapping from AI generator (which uses Indonesian keys)
			// User provided example uses: pertanyaan, tipe, opsi, kunci_jawaban, rubrik_penilaian, tingkat_kesulitan
			const questionText = q.pertanyaan || q.soal || q.question || "";

			// Map type: "pilihan_ganda" -> "PG", "esai" -> "ESSAY"
			let questionType = "ESSAY";
			const rawType = (q.tipe || q.type || "").toLowerCase();
			if (
				rawType.includes("pilihan") ||
				rawType.includes("ganda") ||
				rawType === "pg"
			) {
				questionType = "PG";
			} else if (rawType.includes("esai") || rawType === "essay") {
				questionType = "ESSAY";
			}

			const options = q.opsi || q.pilihan || q.options || null;
			const answerKey = q.kunci_jawaban || q.answer_key || null;
			const difficulty = q.tingkat_kesulitan || q.difficulty || "sedang";
			const category =
				q.kategori_bloom || q.kategori || q.category || null;
			const rubric = q.rubrik_penilaian || q.rubrik || q.rubric || null;

			const question = await examsRepository.createQuestion({
				teacherId,
				type: questionType as "PG" | "ESSAY",
				question: questionText,
				options: options,
				answerKey: answerKey,
				rubric: rubric,
				difficulty: difficulty,
				category: category,
				isHots: q.is_hots || false,
			});
			questionIds.push(question.id);
		}

		// Create exam with DRAFT status
		const exam = await examsRepository.createExam({
			teacherId,
			title: material.title,
			description: `Dibuat dari: ${material.title}`,
			status: "DRAFT",
			startTime: null,
			endTime: null,
			duration: null,
			settings: {},
		});

		// Link questions to exam
		await examsRepository.addQuestionsToExam(
			exam.id,
			questionIds.map((qId, index) => ({
				questionId: qId,
				order: index,
				points: 1,
			})),
		);

		logger.info(
			{ materialId, examId: exam.id, questionCount: questionIds.length },
			"Exam created from material",
		);

		return exam;
	},
};

// Type for generated question from AI
interface GeneratedQuestion {
	soal?: string;
	question?: string;
	pertanyaan?: string;
	tipe?: string;
	type?: string;
	pilihan?: Record<string, string>;
	options?: Record<string, string>;
	opsi?: Record<string, string>;
	kunci_jawaban?: string;
	answer_key?: string;
	rubrik?: unknown;
	rubric?: unknown;
	rubrik_penilaian?: unknown;
	tingkat_kesulitan?: string;
	difficulty?: string;
	kategori?: string;
	category?: string;
	kategori_bloom?: string;
	is_hots?: boolean;
}
