import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { v4 as uuidv4 } from "uuid";

import { config, logger } from "./libs/config";
import {
	errorMiddleware,
	notFoundHandler,
} from "./middlewares/error.middleware";
import { rateLimitMiddleware } from "./middlewares/rate-limit.middleware";
import type { AppVariables } from "./types";

// Import routes
import { authRoutes } from "./modules/auth/auth.routes";
import { usersRoutes } from "./modules/users/users.routes";
import { materialsRoutes } from "./modules/materials/materials.routes";
import { coursesRoutes } from "./modules/courses/courses.routes";
import { examsRoutes, questionsRoutes } from "./modules/exams/exams.routes";
import { proctoringRoutes } from "./modules/proctoring/proctoring.routes";
import { scoringRoutes } from "./modules/scoring/scoring.routes";
import { analyticsRoutes } from "./modules/analytics/analytics.routes";

// Create Hono app
export const app = new Hono<{ Variables: AppVariables }>();

// Global middlewares
app.use(
	"*",
	cors({
		origin: "*", // Configure properly in production
		allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization"],
		exposeHeaders: [
			"X-Request-Id",
			"X-RateLimit-Limit",
			"X-RateLimit-Remaining",
			"X-RateLimit-Reset",
		],
		credentials: true,
	}),
);

app.use("*", secureHeaders());

// Request ID middleware
app.use("*", async (c, next) => {
	const requestId = c.req.header("x-request-id") || uuidv4();
	c.set("requestId", requestId);
	c.header("X-Request-Id", requestId);
	await next();
});

// Logging middleware
if (config.isDev) {
	app.use("*", honoLogger());
}

// Rate limiting
app.use("*", rateLimitMiddleware);

// Error handling
app.use("*", errorMiddleware);

// Health check endpoint
app.get("/", (c) => {
	return c.json({
		success: true,
		message: "SahabatGuru API is running",
		version: "1.0.0",
		timestamp: new Date().toISOString(),
	});
});

app.get("/health", async (c) => {
	const { checkDatabaseConnection } = await import("./libs/db");
	const dbHealthy = await checkDatabaseConnection();

	return c.json({
		success: true,
		status: dbHealthy ? "healthy" : "degraded",
		checks: {
			database: dbHealthy ? "ok" : "error",
			server: "ok",
		},
		timestamp: new Date().toISOString(),
	});
});

// API routes
const api = new Hono<{ Variables: AppVariables }>();

api.route("/auth", authRoutes);
api.route("/users", usersRoutes);
api.route("/materials", materialsRoutes);
api.route("/courses", coursesRoutes);
api.route("/exams", examsRoutes);
api.route("/questions", questionsRoutes);
api.route("/proctoring", proctoringRoutes);
api.route("/scoring", scoringRoutes);
api.route("/analytics", analyticsRoutes);

// Mount API routes
app.route("/api", api);

// 404 handler
app.notFound(notFoundHandler);

logger.info("Hono app initialized");
