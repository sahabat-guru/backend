import type { Context, Next } from "hono";
import { verifyAccessToken } from "../libs/jwt";
import type { AppVariables } from "../types";

// Auth middleware - validates JWT and attaches user to context
export async function authMiddleware(
	c: Context<{ Variables: AppVariables }>,
	next: Next,
): Promise<Response | void> {
	const authHeader = c.req.header("Authorization");

	if (!authHeader) {
		return c.json(
			{ success: false, error: "Authorization header is required" },
			401,
		);
	}

	const parts = authHeader.split(" ");
	if (parts.length !== 2 || parts[0] !== "Bearer") {
		return c.json(
			{
				success: false,
				error: "Invalid authorization header format. Use: Bearer <token>",
			},
			401,
		);
	}

	const token = parts[1];
	const payload = verifyAccessToken(token);

	if (!payload) {
		return c.json(
			{ success: false, error: "Invalid or expired token" },
			401,
		);
	}

	// Attach user to context
	c.set("user", payload);

	await next();
}

// Optional auth - doesn't fail if no token, but validates if present
export async function optionalAuthMiddleware(
	c: Context<{ Variables: AppVariables }>,
	next: Next,
): Promise<Response | void> {
	const authHeader = c.req.header("Authorization");

	if (authHeader) {
		const parts = authHeader.split(" ");
		if (parts.length === 2 && parts[0] === "Bearer") {
			const payload = verifyAccessToken(parts[1]);
			if (payload) {
				c.set("user", payload);
			}
		}
	}

	await next();
}
