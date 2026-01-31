import { Hono } from "hono";
import { authController } from "./auth.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { createRateLimiter } from "../../middlewares/rate-limit.middleware";
import type { AppVariables } from "../../types";

const authRoutes = new Hono<{ Variables: AppVariables }>();

// Rate limiter for auth endpoints (more restrictive)
const authRateLimiter = createRateLimiter({ max: 10, windowMs: 60000 });

// Public routes
authRoutes.post("/register", authRateLimiter, authController.register);
authRoutes.post("/login", authRateLimiter, authController.login);
authRoutes.post("/refresh", authRateLimiter, authController.refresh);

// Protected routes
authRoutes.post("/logout", authMiddleware, authController.logout);
authRoutes.post("/logout-all", authMiddleware, authController.logoutAll);
authRoutes.post(
	"/change-password",
	authMiddleware,
	authController.changePassword,
);
authRoutes.get("/me", authMiddleware, authController.me);

export { authRoutes };
