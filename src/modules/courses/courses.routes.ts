import { Hono } from "hono";
import { coursesController } from "./courses.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { muridOnly } from "../../middlewares/role.guard";
import type { AppVariables } from "../../types";

const coursesRoutes = new Hono<{ Variables: AppVariables }>();

// All routes require authentication and MURID role
coursesRoutes.use("*", authMiddleware, muridOnly);

// Material access routes (read-only)
coursesRoutes.get("/materials", coursesController.listMaterials);
coursesRoutes.get("/materials/:id", coursesController.getMaterial);

export { coursesRoutes };
