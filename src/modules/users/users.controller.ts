import type { Context } from "hono";
import { usersService } from "./users.service";
import { updateProfileSchema } from "./users.schema";
import type { AppVariables } from "../../types";

export const usersController = {
	// GET /users/me
	async getProfile(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");

		const profile = await usersService.getProfile(user.sub);

		return c.json({
			success: true,
			data: profile,
		});
	},

	// PUT /users/me
	async updateProfile(c: Context<{ Variables: AppVariables }>) {
		const user = c.get("user");
		const body = await c.req.json();
		const input = updateProfileSchema.parse(body);

		const updated = await usersService.updateProfile(user.sub, input);

		return c.json({
			success: true,
			data: updated,
			message: "Profile updated successfully",
		});
	},

	// GET /users/stats (for analytics)
	async getStatistics(c: Context) {
		const stats = await usersService.getStatistics();

		return c.json({
			success: true,
			data: stats,
		});
	},
};
