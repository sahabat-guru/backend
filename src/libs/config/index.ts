import "dotenv/config";
import pino from "pino";

// Environment configuration with validation
export const config = {
	// Server
	port: parseInt(process.env.PORT || "8080", 10),
	nodeEnv: process.env.NODE_ENV || "development",
	isDev: process.env.NODE_ENV !== "production",
	isProd: process.env.NODE_ENV === "production",

	// Database
	databaseUrl:
		process.env.DATABASE_URL ||
		"postgresql://postgres:postgres@localhost:5432/sahabatguru",

	// JWT
	jwt: {
		secret:
			process.env.JWT_SECRET ||
			"your-super-secret-jwt-key-change-in-production",
		accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
		refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
	},

	// Google Cloud Storage
	gcs: {
		projectId: process.env.GCS_PROJECT_ID || "",
		bucketName: process.env.GCS_BUCKET_NAME || "sahabatguru-storage",
		keyFile: process.env.GCS_KEY_FILE || "./gcs-credentials.json",
	},

	// External Services
	services: {
		materialGeneratorUrl:
			process.env.MATERIAL_GENERATOR_URL ||
			"https://ppt-generator-service-865275048150.asia-southeast2.run.app",
		cheatingDetectionUrl:
			process.env.CHEATING_DETECTION_URL ||
			"https://cheating-detection-865275048150.asia-southeast2.run.app",
	},

	// Rate Limiting
	rateLimit: {
		max: parseInt(process.env.RATE_LIMIT_MAX || "100", 10),
		windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10),
	},

	// Logging
	logLevel: process.env.LOG_LEVEL || "debug",
} as const;

// Logger instance
export const logger = pino({
	level: config.logLevel,
	transport: config.isDev
		? {
				target: "pino-pretty",
				options: {
					colorize: true,
					translateTime: "SYS:standard",
					ignore: "pid,hostname",
				},
			}
		: undefined,
});

// Validate required environment variables
export function validateConfig(): void {
	const requiredVars: string[] = [];

	if (config.isProd) {
		requiredVars.push("JWT_SECRET", "DATABASE_URL");
	}

	const missing = requiredVars.filter((key) => !process.env[key]);

	if (missing.length > 0) {
		throw new Error(
			`Missing required environment variables: ${missing.join(", ")}`,
		);
	}
}
