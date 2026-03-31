import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function getUserImage(id: string) {
  const [row] = await db
    .select({ image: users.image })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return row?.image ?? null;
}

export async function getUserProfile(id: string) {
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      emailVerified: users.emailVerified,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return user ?? null;
}

export async function getUserByEmail(email: string) {
  const [user] = await db
    .select({ id: users.id, emailVerified: users.emailVerified })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return user ?? null;
}

export async function createUser(data: {
  email: string;
  name?: string | null;
  passwordHash: string;
}) {
  const [user] = await db
    .insert(users)
    .values({
      email: data.email,
      name: data.name ?? null,
      passwordHash: data.passwordHash,
    })
    .returning({ id: users.id, email: users.email });
  return user;
}

interface ProfileUpdate {
  name?: string | null;
  email?: string;
  emailVerified?: boolean;
  image?: string | null;
  currency?: string;
}

export async function updateUserProfile(
  id: string,
  updates: ProfileUpdate,
) {
  await db
    .update(users)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(users.id, id));
}

export async function checkEmailTaken(email: string, excludeUserId?: string) {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!existing) return false;
  if (excludeUserId && existing.id === excludeUserId) return false;
  return true;
}

export async function getUserEmailById(id: string) {
  const [row] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return row ?? null;
}

export async function deleteUser(id: string) {
  await db.delete(users).where(eq(users.id, id));
}
