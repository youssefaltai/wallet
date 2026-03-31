import { db } from "@/lib/db";
import { rateLimitAttempts } from "@/lib/db/schema";
import { sql, lt } from "drizzle-orm";

/**
 * Postgres-backed rate limiter. Survives process restarts and works
 * across multiple containers/workers.
 */
export async function rateLimit(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 15 * 60 * 1000
): Promise<{ allowed: boolean; remaining: number }> {
  const now = new Date();
  const nowISO = now.toISOString();
  const resetAt = new Date(now.getTime() + windowMs);
  const resetAtISO = resetAt.toISOString();

  // Clean up expired entries periodically (fire-and-forget)
  db.delete(rateLimitAttempts)
    .where(lt(rateLimitAttempts.resetAt, now))
    .execute()
    .catch(() => {});

  // Atomic upsert: insert if new key, increment if existing and not expired,
  // reset if existing but expired
  const result = await db
    .insert(rateLimitAttempts)
    .values({ key, count: 1, resetAt })
    .onConflictDoUpdate({
      target: rateLimitAttempts.key,
      set: {
        count: sql`CASE WHEN ${rateLimitAttempts.resetAt} < ${nowISO}::timestamptz THEN 1 ELSE ${rateLimitAttempts.count} + 1 END`,
        resetAt: sql`CASE WHEN ${rateLimitAttempts.resetAt} < ${nowISO}::timestamptz THEN ${resetAtISO}::timestamptz ELSE ${rateLimitAttempts.resetAt} END`,
      },
    })
    .returning({ count: rateLimitAttempts.count });

  const count = result[0]?.count ?? 1;
  const allowed = count <= maxAttempts;
  const remaining = allowed ? maxAttempts - count : 0;

  return { allowed, remaining };
}
