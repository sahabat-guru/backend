// User roles
export enum Role {
	GURU = "GURU",
	MURID = "MURID",
}

// Material types
export enum MaterialType {
	PPT = "PPT",
	RPP = "RPP",
	LKPD = "LKPD",
	QUESTIONS = "QUESTIONS",
}

// Question types
export enum QuestionType {
	PG = "PG", // Pilihan Ganda
	ESSAY = "ESSAY",
}

// Exam status
export enum ExamStatus {
	DRAFT = "DRAFT",
	ONGOING = "ONGOING",
	FINISHED = "FINISHED",
}

// Answer status
export enum AnswerStatus {
	PENDING = "PENDING",
	SCORED = "SCORED",
}

// Proctoring event types
export enum ProctoringEventType {
	HEAD_POSE = "HEAD_POSE",
	EYE_GAZE = "EYE_GAZE",
	OBJECT = "OBJECT",
	LIP = "LIP",
	MULTI_FACE = "MULTI_FACE",
	FACE_ABSENT = "FACE_ABSENT",
}

// JWT Payload
export interface JWTPayload {
	sub: string; // user id
	email: string;
	role: Role;
	type: "access" | "refresh";
	iat?: number;
	exp?: number;
}

// API Response types
export interface ApiResponse<T = unknown> {
	success: boolean;
	data?: T;
	message?: string;
	error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
	pagination: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
}

// Hono context variables
export interface AppVariables {
	user: JWTPayload;
	requestId: string;
}

// External service types
export interface PPTGenerateRequest {
	template: string;
	topic: string;
	kurikulum: "kurikulum_merdeka" | "kurikulum_2013" | "cambridge" | "international_baccalaureate";
	jenjang?: string;
	detail_level: "ringkas" | "sedang" | "lengkap";
	include_examples: boolean;
}

export interface PPTGenerateResponse {
	success: boolean;
	url: string;
	preview_url: string;
	filename: string;
	template_used: string;
	topic: string;
	total_slides: number;
}

export interface RPPGenerateRequest {
	topic: string;
	kurikulum: "kurikulum_merdeka" | "kurikulum_2013" | "cambridge" | "international_baccalaureate";
	jenjang?: string;
	tujuan_pembelajaran: string[];
	karakteristik_siswa: string;
	alokasi_waktu: string;
}

export interface RPPGenerateResponse {
	success: boolean;
	url: string;
	preview_url: string;
	filename: string;
	topic: string;
}

export interface LKPDGenerateRequest {
	topik_lkpd: string;
	kurikulum: "kurikulum_merdeka" | "kurikulum_2013" | "cambridge" | "international_baccalaureate";
	jenjang?: string;
	kelas: string; // Required by external API, set to same value as jenjang
	mata_pelajaran: string;
	jenis_lkpd: "latihan" | "praktikum" | "proyek" | "cheat_sheet";
	fitur_tambahan?: Record<string, unknown>;
}

export interface LKPDGenerateResponse {
	success: boolean;
	url: string;
	preview_url: string;
	filename: string;
	topik: string;
	jenis_lkpd: string;
}

export interface QuestionsGenerateRequest {
	topic: string;
	jenjang?: string;
	jumlah_soal: number;
	tipe_soal: ("pilihan_ganda" | "esai")[];
	tingkat_kesulitan: ("mudah" | "sedang" | "sulit")[];
	include_hots: boolean;
}

export interface QuestionContent {
	nomor: number;
	tipe: string;
	pertanyaan: string;
	opsi?: Record<string, string>;
	kunci_jawaban: string;
	pembahasan: string;
	rubrik_penilaian?: Record<string, number>;
	tingkat_kesulitan: string;
	kategori_bloom: string;
	is_hots: boolean;
}

export interface QuestionsGenerateResponse {
	success: boolean;
	url: string;
	preview_url: string;
	filename: string;
	topic: string;
	jumlah_soal: number;
	content: QuestionContent[];
}

export interface TemplateInfo {
	id: string;
	name: string;
	description: string;
}

// Proctoring service types
export interface StartSessionRequest {
	student_id: string;
	exam_id: string;
	student_name: string;
	exam_name: string;
}

export interface BrowserEventRequest {
	session_id: string;
	event_type: string;
	details: Record<string, unknown>;
}

// WebSocket event types
export interface ExamJoinPayload {
	examId: string;
	token: string;
}

export interface ProctoringFramePayload {
	sessionId: string;
	frame: string; // base64 encoded
}

export interface ProctoringAlertPayload {
	studentId: string;
	studentName: string;
	examId: string;
	type: ProctoringEventType;
	confidence: number;
	timestamp: Date;
}
