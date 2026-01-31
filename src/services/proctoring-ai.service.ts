import { config, logger } from "../libs/config";
import type { StartSessionRequest, BrowserEventRequest } from "../types";

const BASE_URL = config.services.cheatingDetectionUrl;

// Generic fetch wrapper with error handling
async function fetchAPI<T>(
	endpoint: string,
	options: RequestInit = {},
): Promise<T> {
	const url = `${BASE_URL}${endpoint}`;

	logger.debug(
		{ method: options.method || "GET", endpoint },
		"Proctoring AI API call",
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
			`Proctoring AI API error: ${response.status}`,
		);
		throw new Error(
			`Proctoring AI API error: ${response.status} - ${errorText}`,
		);
	}

	return response.json() as Promise<T>;
}

// Session data from proctoring service
export interface SessionData {
	session_id: string;
	student_id: string;
	exam_id: string;
	student_name: string;
	exam_name: string;
	start_time: string;
	end_time?: string;
	status: "active" | "ended";
}

export interface SessionEvent {
	event_type: string;
	timestamp: string;
	details: Record<string, unknown>;
	confidence?: number;
}

export interface ActiveSession {
	session_id: string;
	student_id: string;
	exam_id: string;
	student_name: string;
	start_time: string;
}

// Proctoring AI Service
export const proctoringAIService = {
	// Health check
	async healthCheck(): Promise<boolean> {
		try {
			const response = await fetch(`${BASE_URL}/`);
			return response.ok;
		} catch {
			return false;
		}
	},

	// Start proctoring session
	async startSession(data: StartSessionRequest): Promise<string> {
		logger.info(
			{ studentId: data.student_id, examId: data.exam_id },
			"Starting proctoring session",
		);

		const response = await fetchAPI<string>("/api/sessions/start", {
			method: "POST",
			body: JSON.stringify(data),
		});

		logger.info({ sessionId: response }, "Proctoring session started");

		return response;
	},

	// End proctoring session
	async endSession(sessionId: string): Promise<void> {
		logger.info({ sessionId }, "Ending proctoring session");

		await fetchAPI<string>(`/api/sessions/${sessionId}/end`, {
			method: "POST",
		});

		logger.info({ sessionId }, "Proctoring session ended");
	},

	// Get session data
	async getSession(sessionId: string): Promise<SessionData> {
		const response = await fetchAPI<SessionData>(
			`/api/sessions/${sessionId}`,
		);
		return response;
	},

	// Get session events (violations)
	async getSessionEvents(sessionId: string): Promise<SessionEvent[]> {
		const response = await fetchAPI<SessionEvent[]>(
			`/api/sessions/${sessionId}/events`,
		);
		return response;
	},

	// Report browser event
	async reportBrowserEvent(data: BrowserEventRequest): Promise<void> {
		logger.debug(
			{ sessionId: data.session_id, eventType: data.event_type },
			"Reporting browser event",
		);

		await fetchAPI<string>("/api/browser-event", {
			method: "POST",
			body: JSON.stringify(data),
		});
	},

	// List active sessions
	async listActiveSessions(): Promise<ActiveSession[]> {
		const response = await fetchAPI<ActiveSession[]>("/api/sessions");
		return response;
	},
};
