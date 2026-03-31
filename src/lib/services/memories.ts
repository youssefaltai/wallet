import { db } from "@/lib/db";
import { memories } from "@/lib/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";

export async function saveMemory(
  userId: string,
  content: string,
  tags: string[]
) {
  const [memory] = await db
    .insert(memories)
    .values({ userId, content, tags })
    .returning();
  return memory;
}

export async function updateMemory(
  memoryId: string,
  userId: string,
  updates: { content?: string; tags?: string[] }
) {
  const values: Partial<typeof memories.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (updates.content !== undefined) values.content = updates.content;
  if (updates.tags !== undefined) values.tags = updates.tags;

  const [updated] = await db
    .update(memories)
    .set(values)
    .where(and(eq(memories.id, memoryId), eq(memories.userId, userId)))
    .returning();

  return updated ?? null;
}

export async function deleteMemory(memoryId: string, userId: string) {
  const result = await db
    .delete(memories)
    .where(and(eq(memories.id, memoryId), eq(memories.userId, userId)))
    .returning();
  return result.length > 0;
}

export async function deleteAllMemories(userId: string) {
  await db.delete(memories).where(eq(memories.userId, userId));
}

export async function listMemories(
  userId: string,
  tag?: string,
  limit = 50,
  offset = 0
) {
  const conditions = [eq(memories.userId, userId)];
  if (tag) {
    conditions.push(sql`${memories.tags} @> ARRAY[${tag}]::text[]`);
  }

  return db
    .select({
      id: memories.id,
      content: memories.content,
      tags: memories.tags,
      createdAt: memories.createdAt,
      updatedAt: memories.updatedAt,
    })
    .from(memories)
    .where(and(...conditions))
    .orderBy(desc(memories.updatedAt))
    .limit(limit)
    .offset(offset);
}

export async function countMemories(userId: string, tag?: string): Promise<number> {
  const conditions = [eq(memories.userId, userId)];
  if (tag) {
    conditions.push(sql`${memories.tags} @> ARRAY[${tag}]::text[]`);
  }

  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(memories)
    .where(and(...conditions));

  return result.count;
}

export async function getMemoriesForContext(userId: string, limit = 50) {
  return db
    .select({
      id: memories.id,
      content: memories.content,
      tags: memories.tags,
    })
    .from(memories)
    .where(eq(memories.userId, userId))
    .orderBy(desc(memories.updatedAt))
    .limit(limit);
}
