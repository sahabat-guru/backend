import { Hono } from "hono";
import { usersController } from "./users.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import type { AppVariables } from "../../types";

const usersRoutes = new Hono<{ Variables: AppVariables }>();

// All routes require authentication
usersRoutes.use("*", authMiddleware);

// Profile routes
usersRoutes.get("/me", usersController.getProfile);
usersRoutes.put("/me", usersController.updateProfile);

// Statistics (for analytics)
usersRoutes.get("/stats", usersController.getStatistics);

export { usersRoutes };
