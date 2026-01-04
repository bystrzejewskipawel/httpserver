import { asc, eq, desc } from "drizzle-orm";
import { db } from "../index.js";
import { NewChirp, chirps, User, Chirp } from "../schema.js";

export async function createChirp(chirp: NewChirp) {
  const [result] = await db
    .insert(chirps)
    .values(chirp)
    .onConflictDoNothing()
    .returning();
  return result;
}

export async function deleteChirps() {
  const [result] = await db.delete(chirps);
  return result;
}

export async function getAllChirps(): Promise<Chirp[]> {
  const result = await db.select().from(chirps).orderBy(asc(chirps.createdAt));
  return result;
}

export async function getAllChirpsSortBy(sortMethod: string): Promise<Chirp[]> {
  let result;
  if (sortMethod === "asc") {
    result = await db.select().from(chirps).orderBy(asc(chirps.createdAt));
  } else if (sortMethod === "desc") {
    result = await db.select().from(chirps).orderBy(desc(chirps.createdAt));
  } else {
    result = await db.select().from(chirps);
  }
  return result;
}

export async function getAllChirpsOfAuthor(userId: string): Promise<Chirp[]> {
  const result = await db.select().from(chirps).where(eq(chirps.userId, userId)).orderBy(asc(chirps.createdAt));
  return result;
}

export async function getChirpByID(id: string): Promise<Chirp> {
  const [result] = await db.select().from(chirps).where(eq(chirps.id, id));
  return result;
}

export async function deleteChirpByID(id: string): Promise<Chirp> {
  const [result] = await db.delete(chirps).where(eq(chirps.id, id)).returning();
  return result;
}