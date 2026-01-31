import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { config, logger } from "../config";
import * as schema from "./schema";

const { Pool } = pg;

// Create PostgreSQL connection pool
const pool = new Pool({
	connectionString: config.databaseUrl,
	max: 20,
	idleTimeoutMillis: 30000,
	connectionTimeoutMillis: 2000,
});

// Handle pool errors
pool.on("error", (err) => {
	logger.error({ err }, "Unexpected error on idle client");
});

// Create drizzle instance with schema
export const db = drizzle(pool, { schema });

// Health check function
export async function checkDatabaseConnection(): Promise<boolean> {
	try {
		const client = await pool.connect();
		await client.query("SELECT 1");
		client.release();
		logger.info("Database connection successful");
		return true;
	} catch (error) {
		logger.error({ err: error }, "Database connection failed");
		return false;
	}
}

// Graceful shutdown
export async function closeDatabaseConnection(): Promise<void> {
	await pool.end();
	logger.info("Database connection pool closed");
}

// Export pool for advanced usage
export { pool };
