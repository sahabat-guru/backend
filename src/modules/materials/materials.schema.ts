import { z } from "zod";
import { MaterialType } from "../../types";

// Base generate material schema
const baseGenerateSchema = z.object({
	kurikulum: z
		.enum(["kurikulum_merdeka", "kurikulum_2013"])
		.default("kurikulum_merdeka"),
	jenjang: z.string().min(1, "Jenjang is required"),
});

// Generate PPT schema
export const generatePPTSchema = baseGenerateSchema.extend({
	type: z.literal("PPT"),
	template: z.string().default("minimalis"),
	topic: z.string().min(1, "Topic is required"),
	detail_level: z.enum(["ringkas", "lengkap"]).default("lengkap"),
	include_examples: z.boolean().default(true),
});

export type GeneratePPTInput = z.infer<typeof generatePPTSchema>;

// Generate RPP schema
export const generateRPPSchema = baseGenerateSchema.extend({
	type: z.literal("RPP"),
	topic: z.string().min(1, "Topic is required"),
	tujuan_pembelajaran: z
		.array(z.string())
		.min(1, "At least one learning objective is required"),
	karakteristik_siswa: z.string().optional(),
	alokasi_waktu: z.string().default("2 x 45 menit"),
});

export type GenerateRPPInput = z.infer<typeof generateRPPSchema>;

// Generate LKPD schema
export const generateLKPDSchema = baseGenerateSchema.extend({
	type: z.literal("LKPD"),
	topik_lkpd: z.string().min(1, "Topic is required"),
	mata_pelajaran: z.string().min(1, "Subject is required"),
	kelas: z.string().min(1, "Class is required"),
	jenis_lkpd: z
		.enum(["proyek", "eksperimen", "diskusi", "latihan"])
		.default("latihan"),
	fitur_tambahan: z.record(z.unknown()).optional(),
});

export type GenerateLKPDInput = z.infer<typeof generateLKPDSchema>;

// Generate Questions schema
export const generateQuestionsSchema = z.object({
	type: z.literal("QUESTIONS"),
	topic: z.string().min(1, "Topic is required"),
	jenjang: z.string().min(1, "Jenjang is required"),
	jumlah_soal: z.number().int().positive().max(50).default(10),
	tipe_soal: z.array(z.enum(["pilihan_ganda", "esai"])).min(1),
	tingkat_kesulitan: z.array(z.enum(["mudah", "sedang", "sulit"])).min(1),
	include_hots: z.boolean().default(true),
});

export type GenerateQuestionsInput = z.infer<typeof generateQuestionsSchema>;

// Union type for all generate inputs
export const generateMaterialSchema = z.discriminatedUnion("type", [
	generatePPTSchema,
	generateRPPSchema,
	generateLKPDSchema,
	generateQuestionsSchema,
]);

export type GenerateMaterialInput = z.infer<typeof generateMaterialSchema>;

// Update material schema
export const updateMaterialSchema = z.object({
	title: z.string().min(1).optional(),
	isPublished: z.boolean().optional(),
});

export type UpdateMaterialInput = z.infer<typeof updateMaterialSchema>;

// List materials query schema
export const listMaterialsQuerySchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(50).default(20),
	type: z.nativeEnum(MaterialType).optional(),
	isPublished: z.coerce.boolean().optional(),
	search: z.string().optional(),
});

export type ListMaterialsQuery = z.infer<typeof listMaterialsQuerySchema>;
