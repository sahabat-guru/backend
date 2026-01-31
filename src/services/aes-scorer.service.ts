import { config, logger } from "../libs/config";

// Types for AES Scorer API
export interface ScoreTextRequest {
	student_answer: string;
	answer_key: string;
	rubric?: Record<string, number>;
	question?: string;
}

export interface RubricBreakdown {
	pemahaman_konsep?: number;
	kelengkapan_jawaban?: number;
	struktur_dan_organisasi?: number;
	tata_bahasa?: number;
	[key: string]: number | undefined;
}

export interface ScoringFeedback {
	overall: string;
	strengths: string[];
	improvements: string[];
}

export interface ScoringResult {
	score: number;
	total_points: number;
	max_points: number;
	rubric_breakdown: RubricBreakdown;
	feedback: ScoringFeedback;
}

export interface ScoreTextResponse {
	success: boolean;
	result: ScoringResult;
}

export interface ScoreImageResponse {
	success: boolean;
	ocr_result: {
		success: boolean;
		text: string;
		image_path?: string;
	};
	scoring_result: ScoringResult;
	extracted_text: string;
	error?: string;
}

const BASE_URL = config.services.aesScorerUrl;

// Generic fetch wrapper with error handling
async function fetchAPI<T>(
	endpoint: string,
	options: RequestInit = {},
): Promise<T> {
	const url = `${BASE_URL}${endpoint}`;

	logger.debug(
		{ method: options.method || "GET", endpoint },
		"AES Scorer API call",
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
			`AES Scorer API error: ${response.status}`,
		);
		throw new Error(
			`AES Scorer API error: ${response.status} - ${errorText}`,
		);
	}

	return response.json() as Promise<T>;
}

// AES Scorer Service
export const aesScorerService = {
	// Health check
	async healthCheck(): Promise<boolean> {
		try {
			await fetch(`${BASE_URL}/health`);
			return true;
		} catch {
			return false;
		}
	},

	// Score essay from text
	async scoreText(
		studentAnswer: string,
		answerKey: string,
		rubric?: Record<string, number>,
		question?: string,
	): Promise<ScoringResult> {
		logger.info("Scoring essay text with AI");

		const request: ScoreTextRequest = {
			student_answer: studentAnswer,
			answer_key: answerKey,
			rubric,
			question,
		};

		const response = await fetchAPI<ScoreTextResponse>("/api/score/text", {
			method: "POST",
			body: JSON.stringify(request),
		});

		if (!response.success) {
			throw new Error("AI scoring failed");
		}

		logger.info(
			{ score: response.result.score },
			"Essay scored successfully",
		);

		return response.result;
	},

	// Score essay from image URL (downloads and sends to AI)
	async scoreImage(
		imageUrl: string,
		answerKey: string,
		rubric?: Record<string, number>,
		question?: string,
	): Promise<ScoreImageResponse> {
		logger.info({ imageUrl }, "Scoring essay image with AI");

		// For now, we'll need to download the image and send as form data
		// This is a simplified version - in production, might need proper file handling
		try {
			const imageResponse = await fetch(imageUrl);
			if (!imageResponse.ok) {
				throw new Error(`Failed to fetch image: ${imageUrl}`);
			}

			const imageBlob = await imageResponse.blob();
			const formData = new FormData();
			formData.append("file", imageBlob, "answer.jpg");
			formData.append("answer_key", answerKey);
			if (question) {
				formData.append("question", question);
			}
			if (rubric) {
				formData.append("rubric_json", JSON.stringify(rubric));
			}

			const response = await fetch(`${BASE_URL}/api/score/image`, {
				method: "POST",
				body: formData,
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`AI image scoring failed: ${errorText}`);
			}

			const result = (await response.json()) as ScoreImageResponse;

			logger.info(
				{ score: result.scoring_result?.score },
				"Image essay scored successfully",
			);

			return result;
		} catch (error) {
			logger.error({ err: error }, "Failed to score image");
			throw error;
		}
	},
};
