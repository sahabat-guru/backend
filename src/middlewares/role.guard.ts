import type { Context, Next } from "hono";
import { Role, type AppVariables } from "../types";

// Role guard factory - creates middleware that checks for specific roles
export function roleGuard(...allowedRoles: Role[]) {
	return async function (
		c: Context<{ Variables: AppVariables }>,
		next: Next,
	): Promise<Response | void> {
		const user = c.get("user");

		if (!user) {
			return c.json(
				{ success: false, error: "Authentication required" },
				401,
			);
		}

		if (!allowedRoles.includes(user.role as Role)) {
			return c.json(
				{
					success: false,
					error: `Access denied. Required role: ${allowedRoles.join(" or ")}`,
				},
				403,
			);
		}

		await next();
	};
}

// Convenience guards for common use cases
export const guruOnly = roleGuard(Role.GURU);
export const muridOnly = roleGuard(Role.MURID);
export const anyRole = roleGuard(Role.GURU, Role.MURID);
