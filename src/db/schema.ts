import { pgTable, timestamp, varchar, uuid, text, boolean } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  email: varchar("email", { length: 256 }).unique().notNull(),
  password: varchar("hashed_password").notNull().default("unset"),
  isChirpyRed: boolean("is_chirpy_red").notNull().default(false),
});

export const chirps = pgTable("chirps", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  body: text("email").notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull()
});

export const tokens = pgTable("refresh_tokens", {
  token: text("token").primaryKey().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  userId: uuid("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at")
});

export type NewUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewChirp = typeof chirps.$inferInsert;
export type Chirp = typeof chirps.$inferSelect;
export type NewRefreshToken = typeof tokens.$inferInsert;