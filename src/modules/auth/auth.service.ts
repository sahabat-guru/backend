import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../../libs/db";
import { users, refreshTokens } from "../../libs/db/schema";
import {
	generateTokens,
	verifyRefreshToken,
	getRefreshTokenExpiry,
} from "../../libs/jwt";
import { logger } from "../../libs/config";
import {
	ConflictError,
	UnauthorizedError,
	NotFoundError,
} from "../../middlewares/error.middleware";
import type {
	RegisterInput,
	LoginInput,
	ChangePasswordInput,
} from "./auth.schema";
import type { Role } from "../../types";

const SALT_ROUNDS = 12;

export const authService = {
	// Register new user
	async register(input: RegisterInput) {
		// Check if email already exists
		const existingUser = await db.query.users.findFirst({
			where: eq(users.email, input.email.toLowerCase()),
		});

		if (existingUser) {
			throw new ConflictError("Email already registered");
		}

		// Hash password
		const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

		// Create user
		const [newUser] = await db
			.insert(users)
			.values({
				name: input.name,
				email: input.email.toLowerCase(),
				passwordHash,
				role: input.role,
			})
			.returning({
				id: users.id,
				name: users.name,
				email: users.email,
				role: users.role,
				createdAt: users.createdAt,
			});

		logger.info(`New user registered: ${newUser.email}`);

		// Generate tokens
		const tokens = generateTokens({
			sub: newUser.id,
			email: newUser.email,
			role: newUser.role as Role,
		});

		// Store refresh token
		await db.insert(refreshTokens).values({
			userId: newUser.id,
			token: tokens.refreshToken,
			expiresAt: getRefreshTokenExpiry(),
		});

		return {
			user: newUser,
			...tokens,
		};
	},

	// Login user
	async login(input: LoginInput) {
		// Find user by email
		const user = await db.query.users.findFirst({
			where: eq(users.email, input.email.toLowerCase()),
		});

		if (!user) {
			throw new UnauthorizedError("Invalid email or password");
		}

		// Verify password
		const isValidPassword = await bcrypt.compare(
			input.password,
			user.passwordHash,
		);

		if (!isValidPassword) {
			throw new UnauthorizedError("Invalid email or password");
		}

		logger.info(`User logged in: ${user.email}`);

		// Generate tokens
		const tokens = generateTokens({
			sub: user.id,
			email: user.email,
			role: user.role as Role,
		});

		// Store refresh token
		await db.insert(refreshTokens).values({
			userId: user.id,
			token: tokens.refreshToken,
			expiresAt: getRefreshTokenExpiry(),
		});

		return {
			user: {
				id: user.id,
				name: user.name,
				email: user.email,
				role: user.role,
			},
			...tokens,
		};
	},

	// Refresh access token
	async refreshAccessToken(refreshToken: string) {
		// Verify the refresh token
		const payload = verifyRefreshToken(refreshToken);

		if (!payload) {
			throw new UnauthorizedError("Invalid or expired refresh token");
		}

		// Check if token exists in database
		const storedToken = await db.query.refreshTokens.findFirst({
			where: eq(refreshTokens.token, refreshToken),
		});

		if (!storedToken) {
			throw new UnauthorizedError("Refresh token not found");
		}

		// Check if token is expired
		if (storedToken.expiresAt < new Date()) {
			// Delete expired token
			await db
				.delete(refreshTokens)
				.where(eq(refreshTokens.token, refreshToken));
			throw new UnauthorizedError("Refresh token expired");
		}

		// Get user
		const user = await db.query.users.findFirst({
			where: eq(users.id, payload.sub),
		});

		if (!user) {
			throw new NotFoundError("User");
		}

		// Generate new tokens
		const tokens = generateTokens({
			sub: user.id,
			email: user.email,
			role: user.role as Role,
		});

		// Delete old refresh token
		await db
			.delete(refreshTokens)
			.where(eq(refreshTokens.token, refreshToken));

		// Store new refresh token
		await db.insert(refreshTokens).values({
			userId: user.id,
			token: tokens.refreshToken,
			expiresAt: getRefreshTokenExpiry(),
		});

		logger.info(`Token refreshed for user: ${user.email}`);

		return tokens;
	},

	// Logout user
	async logout(refreshToken: string) {
		// Delete refresh token from database
		const result = await db
			.delete(refreshTokens)
			.where(eq(refreshTokens.token, refreshToken))
			.returning();

		if (result.length > 0) {
			logger.info("User logged out");
		}

		return { success: true };
	},

	// Logout all sessions
	async logoutAll(userId: string) {
		await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
		logger.info(`All sessions logged out for user: ${userId}`);
		return { success: true };
	},

	// Change password
	async changePassword(userId: string, input: ChangePasswordInput) {
		// Get user
		const user = await db.query.users.findFirst({
			where: eq(users.id, userId),
		});

		if (!user) {
			throw new NotFoundError("User");
		}

		// Verify current password
		const isValidPassword = await bcrypt.compare(
			input.currentPassword,
			user.passwordHash,
		);

		if (!isValidPassword) {
			throw new UnauthorizedError("Current password is incorrect");
		}

		// Hash new password
		const newPasswordHash = await bcrypt.hash(
			input.newPassword,
			SALT_ROUNDS,
		);

		// Update password
		await db
			.update(users)
			.set({
				passwordHash: newPasswordHash,
				updatedAt: new Date(),
			})
			.where(eq(users.id, userId));

		// Invalidate all refresh tokens
		await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));

		logger.info(`Password changed for user: ${user.email}`);

		return { success: true };
	},

	// Get current user
	async getCurrentUser(userId: string) {
		const user = await db.query.users.findFirst({
			where: eq(users.id, userId),
			columns: {
				id: true,
				name: true,
				email: true,
				role: true,
				createdAt: true,
			},
		});

		if (!user) {
			throw new NotFoundError("User");
		}

		return user;
	},
};
