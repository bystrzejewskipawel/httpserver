import { describe, it, expect, beforeAll } from "vitest";
import { makeJWT, validateJWT, hashPassword, checkPasswordHash } from "./src/auth.js";

describe("Password Hashing", () => {
  const password1 = "correctPassword123!";
  const password2 = "anotherPassword456!";
  let hash1: string;
  let hash2: string;

  beforeAll(async () => {
    hash1 = await hashPassword(password1);
    hash2 = await hashPassword(password2);
  });

  it("should return true for the correct password", async () => {
    const result = await checkPasswordHash(password1, hash1);
    expect(result).toBe(true);
  });
});

describe("Tokens", () => {
    const userId = "User1";
    const secret = "shhhecret"
    const token = makeJWT(userId, 30, secret);

  it("should decrypt the token", () => {
    const result = validateJWT(token, secret);
    expect(result).toEqual(userId);
  });

  it("should fail when wrong secret", () => {
    expect(() => validateJWT(token, "invalidSecret")).toThrowError(/^Invalid token$/);
  });
});