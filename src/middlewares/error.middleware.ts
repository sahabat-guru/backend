import type { Context, Next } from "hono";
import { logger } from "../libs/config";
import { ZodError } from "zod";

// Custom error class for application errors
export class AppError extends Error {
	constructor(
		public statusCode: number,
		message: string,
		public code?: string,
	) {
		super(message);
		this.name = "AppError";
	}
}

// Not found error
export class NotFoundError extends AppError {
	constructor(resource: string = "Resource") {
		super(404, `${resource} not found`, "NOT_FOUND");
	}
}

// Unauthorized error
export class UnauthorizedError extends AppError {
	constructor(message: string = "Unauthorized") {
		super(401, message, "UNAUTHORIZED");
	}
}

// Forbidden error
export class ForbiddenError extends AppError {
	constructor(message: string = "Access denied") {
		super(403, message, "FORBIDDEN");
	}
}

// Bad request error
export class BadRequestError extends AppError {
	constructor(message: string = "Bad request") {
		super(400, message, "BAD_REQUEST");
	}
}

// Conflict error
export class ConflictError extends AppError {
	constructor(message: string = "Resource already exists") {
		super(409, message, "CONFLICT");
	}
}

// Error handler middleware
export async function errorMiddleware(
	c: Context,
	next: Next,
): Promise<Response | void> {
	try {
		await next();
	} catch (error) {
		// Log error
		logger.error(
			{
				err: error instanceof Error ? error : undefined,
				path: c.req.path,
				method: c.req.method,
			},
			"Request error",
		);

		// Handle Zod validation errors
		if (error instanceof ZodError) {
			return c.json(
				{
					success: false,
					error: "Validation failed",
					details: error.errors.map((e) => ({
						field: e.path.join("."),
						message: e.message,
					})),
				},
				400,
			);
		}

		// Handle application errors
		if (error instanceof AppError) {
			return c.json(
				{
					success: false,
					error: error.message,
					code: error.code,
				},
				error.statusCode as 400 | 401 | 403 | 404 | 409 | 500,
			);
		}

		// Handle unknown errors
		const message =
			error instanceof Error ? error.message : "Internal server error";
		return c.json(
			{
				success: false,
				error:
					process.env.NODE_ENV === "production"
						? "Internal server error"
						: message,
			},
			500,
		);
	}
}

// 404 handler
export function notFoundHandler(c: Context): Response {
	return c.json(
		{
			success: false,
			error: "Endpoint not found",
		},
		404,
	);
}
