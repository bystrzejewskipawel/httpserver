import { db } from "../index.js";
import { NewUser, users } from "../schema.js";
import { eq } from "drizzle-orm";

export async function createUser(user: NewUser) {
  const [result] = await db
    .insert(users)
    .values(user)
    .onConflictDoNothing()
    .returning();
  return result;
}

export async function deleteUsers() {
  const [result] = await db.delete(users);
  return result;
}

export async function getUserByEmail(email: string) {
  const [result] = await db.select().from(users).where(eq(users.email, email));
  return result;
}

export async function updateUser(user: NewUser, userId: string) {
  const [result] = await db.update(users).set({ email: user.email, password: user.password, updatedAt: new Date() }).where(eq(users.id, userId)).returning(); 
  return result;
}

export async function updateToRed(userId: string) {
  const [result] = await db.update(users).set({ isChirpyRed: true, updatedAt: new Date() }).where(eq(users.id, userId)).returning(); 
  return result;
}