import { usersRepository } from "./users.repository";
import { NotFoundError } from "../../middlewares/error.middleware";
import { logger } from "../../libs/config";
import type { UpdateProfileInput, ListUsersQuery } from "./users.schema";

export const usersService = {
	// Get user profile
	async getProfile(userId: string) {
		const user = await usersRepository.findById(userId);

		if (!user) {
			throw new NotFoundError("User");
		}

		return {
			id: user.id,
			name: user.name,
			email: user.email,
			role: user.role,
			createdAt: user.createdAt,
		};
	},

	// Update user profile
	async updateProfile(userId: string, input: UpdateProfileInput) {
		const user = await usersRepository.findById(userId);

		if (!user) {
			throw new NotFoundError("User");
		}

		const updated = await usersRepository.update(userId, input);

		logger.info(`User profile updated: ${user.email}`);

		return {
			id: updated!.id,
			name: updated!.name,
			email: updated!.email,
			role: updated!.role,
			createdAt: updated!.createdAt,
		};
	},

	// List users (for admin/future use)
	async listUsers(query: ListUsersQuery) {
		return usersRepository.list(query);
	},

	// Get user statistics
	async getStatistics() {
		const [guruCount, muridCount] = await Promise.all([
			usersRepository.countByRole("GURU"),
			usersRepository.countByRole("MURID"),
		]);

		return {
			total: guruCount + muridCount,
			guru: guruCount,
			murid: muridCount,
		};
	},
};
