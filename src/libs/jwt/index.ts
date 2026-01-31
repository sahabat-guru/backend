import jwt, { SignOptions } from "jsonwebtoken";
import { config, logger } from "../config";
import type { JWTPayload } from "../../types";

// Generate access token
export function generateAccessToken(
	payload: Omit<JWTPayload, "type" | "iat" | "exp">,
): string {
	const options: SignOptions = {
		expiresIn: config.jwt.accessExpiresIn as jwt.SignOptions["expiresIn"],
	};
	return jwt.sign({ ...payload, type: "access" }, config.jwt.secret, options);
}

// Generate refresh token
export function generateRefreshToken(
	payload: Omit<JWTPayload, "type" | "iat" | "exp">,
): string {
	const options: SignOptions = {
		expiresIn: config.jwt.refreshExpiresIn as jwt.SignOptions["expiresIn"],
	};
	return jwt.sign(
		{ ...payload, type: "refresh" },
		config.jwt.secret,
		options,
	);
}

// Generate both tokens
export function generateTokens(
	payload: Omit<JWTPayload, "type" | "iat" | "exp">,
): {
	accessToken: string;
	refreshToken: string;
} {
	return {
		accessToken: generateAccessToken(payload),
		refreshToken: generateRefreshToken(payload),
	};
}

// Verify token
export function verifyToken(token: string): JWTPayload | null {
	try {
		const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
		return decoded;
	} catch (error) {
		logger.debug({ err: error }, "Token verification failed");
		return null;
	}
}

// Verify access token specifically
export function verifyAccessToken(token: string): JWTPayload | null {
	const payload = verifyToken(token);
	if (payload && payload.type === "access") {
		return payload;
	}
	return null;
}

// Verify refresh token specifically
export function verifyRefreshToken(token: string): JWTPayload | null {
	const payload = verifyToken(token);
	if (payload && payload.type === "refresh") {
		return payload;
	}
	return null;
}

// Decode token without verification (for extracting expiry, etc.)
export function decodeToken(token: string): JWTPayload | null {
	try {
		return jwt.decode(token) as JWTPayload;
	} catch {
		return null;
	}
}

// Get token expiry date
export function getRefreshTokenExpiry(): Date {
	const expiresIn = config.jwt.refreshExpiresIn;
	const match = expiresIn.match(/^(\d+)([smhdw])$/);

	if (!match) {
		// Default to 7 days
		return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
	}

	const value = parseInt(match[1], 10);
	const unit = match[2];

	const multipliers: Record<string, number> = {
		s: 1000,
		m: 60 * 1000,
		h: 60 * 60 * 1000,
		d: 24 * 60 * 60 * 1000,
		w: 7 * 24 * 60 * 60 * 1000,
	};

	return new Date(Date.now() + value * multipliers[unit]);
}
