import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, closeDatabaseConnection } from "./index";
import { logger } from "../config";

async function runMigrations() {
	logger.info("Running database migrations...");

	try {
		await migrate(db, { migrationsFolder: "./drizzle/migrations" });
		logger.info("Migrations completed successfully");
	} catch (error) {
		logger.error({ err: error }, "Migration failed");
		process.exit(1);
	} finally {
		await closeDatabaseConnection();
	}
}

runMigrations();
