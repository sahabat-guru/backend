import { config, logger } from "../libs/config";
import type {
	PPTGenerateRequest,
	PPTGenerateResponse,
	RPPGenerateRequest,
	RPPGenerateResponse,
	LKPDGenerateRequest,
	LKPDGenerateResponse,
	QuestionsGenerateRequest,
	QuestionsGenerateResponse,
	TemplateInfo,
} from "../types";

const BASE_URL = config.services.materialGeneratorUrl;

// Generic fetch wrapper with error handling
async function fetchAPI<T>(
	endpoint: string,
	options: RequestInit = {},
): Promise<T> {
	const url = `${BASE_URL}${endpoint}`;

	logger.debug(
		{ method: options.method || "GET", endpoint },
		"Material Generator API call",
	);

	const response = await fetch(url, {
		...options,
		headers: {
			"Content-Type": "application/json",
			...options.headers,
		},
	});

	if (!response.ok) {
		const errorText = await response.text();
		logger.error(
			{ status: response.status, errorText },
			`Material Generator API error: ${response.status}`,
		);
		throw new Error(
			`Material Generator API error: ${response.status} - ${errorText}`,
		);
	}

	return response.json() as Promise<T>;
}

// Material Generator Service
export const materialGeneratorService = {
	// Health check
	async healthCheck(): Promise<boolean> {
		try {
			await fetch(`${BASE_URL}/`);
			return true;
		} catch {
			return false;
		}
	},

	// Get available templates
	async getTemplates(): Promise<TemplateInfo[]> {
		const response = await fetchAPI<{ templates: TemplateInfo[] }>(
			"/api/templates",
		);
		return response.templates;
	},

	// Generate PPT
	async generatePPT(data: PPTGenerateRequest): Promise<PPTGenerateResponse> {
		logger.info(
			{ topic: data.topic, template: data.template },
			"Generating PPT",
		);

		const response = await fetchAPI<PPTGenerateResponse>(
			"/api/generate/ppt",
			{
				method: "POST",
				body: JSON.stringify(data),
			},
		);

		logger.info(
			{ filename: response.filename, slides: response.total_slides },
			"PPT generated successfully",
		);

		return response;
	},

	// Generate RPP
	async generateRPP(data: RPPGenerateRequest): Promise<RPPGenerateResponse> {
		logger.info({ topic: data.topic }, "Generating RPP");

		const response = await fetchAPI<RPPGenerateResponse>(
			"/api/generate/rpp",
			{
				method: "POST",
				body: JSON.stringify(data),
			},
		);

		logger.info(
			{ filename: response.filename },
			"RPP generated successfully",
		);

		return response;
	},

	// Generate LKPD
	async generateLKPD(
		data: LKPDGenerateRequest,
	): Promise<LKPDGenerateResponse> {
		logger.info({ topic: data.topik_lkpd }, "Generating LKPD");

		const response = await fetchAPI<LKPDGenerateResponse>(
			"/api/generate/lkpd",
			{
				method: "POST",
				body: JSON.stringify(data),
			},
		);

		logger.info(
			{ filename: response.filename },
			"LKPD generated successfully",
		);

		return response;
	},

	// Generate Questions
	async generateQuestions(
		data: QuestionsGenerateRequest,
	): Promise<QuestionsGenerateResponse> {
		logger.info(
			{ topic: data.topic, count: data.jumlah_soal },
			"Generating Questions",
		);

		// Debug: Log the full request body
		logger.info({ requestBody: data }, "Questions API request body");

		const response = await fetchAPI<QuestionsGenerateResponse>(
			"/api/generate/questions",
			{
				method: "POST",
				body: JSON.stringify(data),
			},
		);

		logger.info(
			{ filename: response.filename, count: response.jumlah_soal },
			"Questions generated successfully",
		);

		return response;
	},
};
