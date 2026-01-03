import { asc, eq } from "drizzle-orm";
import { db } from "../index.js";
import { tokens, NewRefreshToken } from "../schema.js";

export async function createRefreshToken(token: NewRefreshToken) {
  const [result] = await db
    .insert(tokens)
    .values(token)
    .onConflictDoNothing()
    .returning();
  return result;
}

// export async function deleteChirps() {
//   const [result] = await db.delete(chirps);
//   return result;
// }

// export async function getAllChirps(): Promise<Chirp[]> {
//   const result = await db.select().from(chirps).orderBy(asc(chirps.createdAt));
//   return result;
// }

export async function getRefreshToken(token: string) {
  const [result] = await db.select().from(tokens).where(eq(tokens.token, token));
  return result;
}

export async function revokeToken(token: string) {
  const [result] = await db.update(tokens).set({ revokedAt: new Date(), updatedAt: new Date() }).where(eq(tokens.token, token)).returning();
  return result;
}