import type { Context, Next } from "hono";
import { config, logger } from "../libs/config";

interface RateLimitStore {
	count: number;
	resetTime: number;
}

// Simple in-memory rate limit store
// In production, consider using Redis for distributed rate limiting
const rateLimitStore = new Map<string, RateLimitStore>();

// Clean up expired entries periodically
setInterval(() => {
	const now = Date.now();
	for (const [key, value] of rateLimitStore.entries()) {
		if (value.resetTime < now) {
			rateLimitStore.delete(key);
		}
	}
}, 60000); // Clean up every minute

// Rate limit middleware
export async function rateLimitMiddleware(
	c: Context,
	next: Next,
): Promise<Response | void> {
	// Get client identifier (IP or user ID if authenticated)
	const clientId =
		c.req.header("x-forwarded-for") ||
		c.req.header("x-real-ip") ||
		"unknown";

	const now = Date.now();
	const windowMs = config.rateLimit.windowMs;
	const maxRequests = config.rateLimit.max;

	// Get or create rate limit entry
	let entry = rateLimitStore.get(clientId);

	if (!entry || entry.resetTime < now) {
		entry = {
			count: 0,
			resetTime: now + windowMs,
		};
		rateLimitStore.set(clientId, entry);
	}

	entry.count++;

	// Set rate limit headers
	c.header("X-RateLimit-Limit", maxRequests.toString());
	c.header(
		"X-RateLimit-Remaining",
		Math.max(0, maxRequests - entry.count).toString(),
	);
	c.header("X-RateLimit-Reset", new Date(entry.resetTime).toISOString());

	if (entry.count > maxRequests) {
		logger.warn(`Rate limit exceeded for client: ${clientId}`);
		return c.json(
			{
				success: false,
				error: "Too many requests. Please try again later.",
			},
			429,
		);
	}

	await next();
}

// Create custom rate limiter with specific options
export function createRateLimiter(options: { max: number; windowMs: number }) {
	const store = new Map<string, RateLimitStore>();

	return async function (c: Context, next: Next): Promise<Response | void> {
		const clientId =
			c.req.header("x-forwarded-for") ||
			c.req.header("x-real-ip") ||
			"unknown";

		const now = Date.now();
		let entry = store.get(clientId);

		if (!entry || entry.resetTime < now) {
			entry = {
				count: 0,
				resetTime: now + options.windowMs,
			};
			store.set(clientId, entry);
		}

		entry.count++;

		if (entry.count > options.max) {
			return c.json(
				{
					success: false,
					error: "Too many requests. Please try again later.",
				},
				429,
			);
		}

		await next();
	};
}
