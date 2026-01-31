import type { Context } from "hono";
import { authService } from "./auth.service";
import {
	registerSchema,
	loginSchema,
	refreshTokenSchema,
	changePasswordSchema,
} from "./auth.schema";
import type { AppVariables } from "../../types";

export const authController = {
	// POST /auth/register
	async register(c: Context) {
		const body = await c.req.json();
		const input = registerSchema.parse(body);

		const result = await authService.register(input);

		return c.json(
			{
				success: true,
				data: result,
				message: "Registration successful",
			},
			201,
		);
	},

	// POST /auth/login
	async login(c: Context) {
		const body = await c.req.json();
		const input = loginSchema.parse(body);

		const result = await authService.login(input);

		return c.json({
			success: true,
			data: result,
			message: "Login successful",
		});
	},

	// POST /auth/refresh
	async refresh(c: Context) {
		const body = await c.req.json();
		const input = refreshTokenSchema.parse(body);

		const tokens = await authService.refreshAccessToken(input.refreshToken);

		return c.json({
			success: true,
			data: tokens,
			message: "Token refreshed successfully",
		});
	},

	// POST /auth/logout
	async logout(c: Context) {
		const body = await c.req.json();
		const { refreshToken } = body;

		if (refreshToken) {
			await authService.logout(refreshToken);
		}

		return c.json({
			success: true,
			message: "Logout successful",
		});
	},

	// POST /auth/logout-all
	async logoutAll(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");

		await authService.logoutAll(user.sub);

		return c.json({
			success: true,
			message: "All sessions logged out",
		});
	},

	// POST /auth/change-password
	async changePassword(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");
		const body = await c.req.json();
		const input = changePasswordSchema.parse(body);

		await authService.changePassword(user.sub, input);

		return c.json({
			success: true,
			message: "Password changed successfully",
		});
	},

	// GET /auth/me
	async me(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");

		const userData = await authService.getCurrentUser(user.sub);

		return c.json({
			success: true,
			data: userData,
		});
	},
};
