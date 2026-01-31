import { serve } from "@hono/node-server";
import { createServer } from "http";
import { app } from "./app";
import { config, logger, validateConfig } from "./libs/config";
import { checkDatabaseConnection, closeDatabaseConnection } from "./libs/db";
import { initializeWebSocket } from "./libs/websocket";

async function bootstrap() {
	try {
		// Validate configuration
		validateConfig();
		logger.info("Configuration validated");

		// Check database connection
		const dbConnected = await checkDatabaseConnection();
		if (!dbConnected) {
			throw new Error("Failed to connect to database");
		}

		// Create HTTP server
		const httpServer = createServer(async (req, res) => {
			// Let Hono handle the request
			const response = await app.fetch(
				new Request(`http://${req.headers.host}${req.url}`, {
					method: req.method,
					headers: Object.entries(req.headers).reduce(
						(acc, [key, value]) => {
							if (value)
								acc[key] = Array.isArray(value)
									? value.join(", ")
									: value;
							return acc;
						},
						{} as Record<string, string>,
					),
					body:
						req.method !== "GET" && req.method !== "HEAD"
							? req
							: undefined,
					// @ts-ignore - duplex is needed for streaming
					duplex: "half",
				}),
			);

			// Send response
			res.writeHead(
				response.status,
				Object.fromEntries(response.headers),
			);
			if (response.body) {
				const reader = response.body.getReader();
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					res.write(value);
				}
			}
			res.end();
		});

		// Initialize WebSocket
		initializeWebSocket(httpServer);
		logger.info("WebSocket server initialized");

		// Start server
		httpServer.listen(config.port, () => {
			logger.info(
				`🚀 SahabatGuru API server running on port ${config.port}`,
			);
			logger.info(`📚 Environment: ${config.nodeEnv}`);
			logger.info(
				`🔗 Health check: http://localhost:${config.port}/health`,
			);
		});

		// Graceful shutdown
		const shutdown = async (signal: string) => {
			logger.info(`${signal} received, shutting down gracefully...`);

			httpServer.close(() => {
				logger.info("HTTP server closed");
			});

			await closeDatabaseConnection();

			process.exit(0);
		};

		process.on("SIGTERM", () => shutdown("SIGTERM"));
		process.on("SIGINT", () => shutdown("SIGINT"));
	} catch (error) {
		logger.error({ err: error }, "Failed to start server");
		process.exit(1);
	}
}

bootstrap();
