import { eq, and, sql, desc, ne } from "drizzle-orm";
import { db } from "../../libs/db";
import { materials } from "../../libs/db/schema";
import type { Material, NewMaterial } from "../../libs/db/schema";
import type { ListMaterialsQuery } from "./materials.schema";

export const materialsRepository = {
	// Create material
	async create(data: NewMaterial): Promise<Material> {
		const [created] = await db.insert(materials).values(data).returning();
		return created;
	},

	// Find by ID
	async findById(id: string): Promise<Material | undefined> {
		return db.query.materials.findFirst({
			where: eq(materials.id, id),
		});
	},

	// Find by ID with teacher check
	async findByIdAndTeacher(
		id: string,
		teacherId: string,
	): Promise<Material | undefined> {
		return db.query.materials.findFirst({
			where: and(
				eq(materials.id, id),
				eq(materials.teacherId, teacherId),
			),
		});
	},

	// Update material
	async update(
		id: string,
		data: Partial<Material>,
	): Promise<Material | undefined> {
		const [updated] = await db
			.update(materials)
			.set({
				...data,
				updatedAt: new Date(),
			})
			.where(eq(materials.id, id))
			.returning();

		return updated;
	},

	// Delete material
	async delete(id: string): Promise<boolean> {
		const result = await db
			.delete(materials)
			.where(eq(materials.id, id))
			.returning();
		return result.length > 0;
	},

	// List materials by teacher
	async listByTeacher(teacherId: string, query: ListMaterialsQuery) {
		const { page, limit, type, isPublished, search } = query;
		const offset = (page - 1) * limit;

		const conditions = [eq(materials.teacherId, teacherId)];

		if (type) {
			conditions.push(eq(materials.type, type));
		}

		if (isPublished !== undefined) {
			conditions.push(eq(materials.isPublished, isPublished));
		}

		if (search) {
			conditions.push(sql`${materials.title} ILIKE ${`%${search}%`}`);
		}

		if (query.excludeType) {
			conditions.push(ne(materials.type, query.excludeType));
		}

		const whereClause = and(...conditions);

		const [data, countResult] = await Promise.all([
			db.query.materials.findMany({
				where: whereClause,
				limit,
				offset,
				orderBy: [desc(materials.createdAt)],
			}),
			db
				.select({ count: sql<number>`count(*)` })
				.from(materials)
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

	// List published materials (for students)
	async listPublished(query: ListMaterialsQuery) {
		const { page, limit, type, search, excludeType } = query;
		const offset = (page - 1) * limit;

		const conditions = [eq(materials.isPublished, true)];

		if (type) {
			conditions.push(eq(materials.type, type));
		}

		if (search) {
			conditions.push(sql`${materials.title} ILIKE ${`%${search}%`}`);
		}

		if (excludeType) {
			conditions.push(ne(materials.type, excludeType));
		}

		const whereClause = and(...conditions);

		const [data, countResult] = await Promise.all([
			db.query.materials.findMany({
				where: whereClause,
				limit,
				offset,
				orderBy: [desc(materials.createdAt)],
				with: {
					teacher: {
						columns: {
							id: true,
							name: true,
						},
					},
				},
			}),
			db
				.select({ count: sql<number>`count(*)` })
				.from(materials)
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

	// Count materials by teacher
	async countByTeacher(teacherId: string): Promise<number> {
		const result = await db
			.select({ count: sql<number>`count(*)` })
			.from(materials)
			.where(eq(materials.teacherId, teacherId));

		return Number(result[0]?.count || 0);
	},
};
