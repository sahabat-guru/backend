import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "./src/libs/db/schema.ts",
	out: "./drizzle/migrations",
	dialect: "postgresql",
	dbCredentials: {
		url:
			process.env.DATABASE_URL ||
			"postgresql://postgres:postgres@localhost:5432/sahabatguru",
	},
	verbose: true,
	strict: true,
});
