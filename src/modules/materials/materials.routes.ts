import { Hono } from "hono";
import { materialsController } from "./materials.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { guruOnly } from "../../middlewares/role.guard";
import type { AppVariables } from "../../types";

const materialsRoutes = new Hono<{ Variables: AppVariables }>();

// All routes require authentication
materialsRoutes.use("*", authMiddleware);

// Public routes (accessible by GURU and MURID)
materialsRoutes.get("/", materialsController.listMaterials);
materialsRoutes.get("/:id", materialsController.getMaterial);

// Protected routes (GURU only)
materialsRoutes.use("*", guruOnly);

// Template routes
materialsRoutes.get("/templates", materialsController.getTemplates);

// Material CRUD routes
materialsRoutes.post("/generate", materialsController.generateMaterial);
// materialsRoutes.get("/", materialsController.listMaterials); // Moved up
// materialsRoutes.get("/:id", materialsController.getMaterial); // Moved up
materialsRoutes.put("/:id", materialsController.updateMaterial);
materialsRoutes.delete("/:id", materialsController.deleteMaterial);

// Publish/unpublish routes
materialsRoutes.post("/:id/publish", materialsController.publishMaterial);
materialsRoutes.post("/:id/unpublish", materialsController.unpublishMaterial);

// Create exam from QUESTIONS material
materialsRoutes.post(
	"/:id/create-exam",
	materialsController.createExamFromMaterial,
);

export { materialsRoutes };
