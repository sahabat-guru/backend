import { eq, ilike, and, sql } from "drizzle-orm";
import { db } from "../../libs/db";
import { users } from "../../libs/db/schema";
import type { User } from "../../libs/db/schema";
import type { ListUsersQuery } from "./users.schema";

export const usersRepository = {
	// Find user by ID
	async findById(id: string): Promise<User | undefined> {
		return db.query.users.findFirst({
			where: eq(users.id, id),
		});
	},

	// Find user by email
	async findByEmail(email: string): Promise<User | undefined> {
		return db.query.users.findFirst({
			where: eq(users.email, email.toLowerCase()),
		});
	},

	// Update user
	async update(
		id: string,
		data: Partial<Pick<User, "name">>,
	): Promise<User | undefined> {
		const [updated] = await db
			.update(users)
			.set({
				...data,
				updatedAt: new Date(),
			})
			.where(eq(users.id, id))
			.returning();

		return updated;
	},

	// List users with pagination
	async list(query: ListUsersQuery) {
		const { page, limit, role, search } = query;
		const offset = (page - 1) * limit;

		const conditions = [];

		if (role) {
			conditions.push(eq(users.role, role));
		}

		if (search) {
			conditions.push(
				sql`(${users.name} ILIKE ${`%${search}%`} OR ${users.email} ILIKE ${`%${search}%`})`,
			);
		}

		const whereClause =
			conditions.length > 0 ? and(...conditions) : undefined;

		const [data, countResult] = await Promise.all([
			db.query.users.findMany({
				where: whereClause,
				columns: {
					id: true,
					name: true,
					email: true,
					role: true,
					createdAt: true,
				},
				limit,
				offset,
				orderBy: (users, { desc }) => [desc(users.createdAt)],
			}),
			db
				.select({ count: sql<number>`count(*)` })
				.from(users)
				.where(whereClause),
		]);

		const total = Number(countResult[0]?.count || 0);

		return {
			data,
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		};
	},

	// Count users by role
	async countByRole(role: "GURU" | "MURID"): Promise<number> {
		const result = await db
			.select({ count: sql<number>`count(*)` })
			.from(users)
			.where(eq(users.role, role));

		return Number(result[0]?.count || 0);
	},

	// Delete user
	async delete(id: string): Promise<boolean> {
		const result = await db
			.delete(users)
			.where(eq(users.id, id))
			.returning();
		return result.length > 0;
	},
};
