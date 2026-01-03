import { hash, verify } from "argon2";
import jwt, { JwtPayload } from "jsonwebtoken";
import { UnauthorizedError } from "./errors.js";
import { Request } from "express";
import { randomBytes } from "node:crypto";

const TOKEN_ISSUER = "chirpy";

export async function hashPassword(password: string): Promise<string> {
    return hash(password);
}

export async function checkPasswordHash(password: string, hash: string): Promise<boolean> {
    if (!password) return false;
    try {
        return await verify(hash, password);
    } catch {
        return false;
    }
}

    type payload = Pick<JwtPayload, "iss" | "sub" | "iat" | "exp">;

export function makeJWT(userID: string, expiresIn: number, secret: string): string {
    const pl: payload = { iss: TOKEN_ISSUER, sub: userID, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + expiresIn};
    return jwt.sign(pl, secret, { algorithm: "HS256" });
}

export function makeRefreshToken() {
    return randomBytes(32).toString('hex');
}

export function validateJWT(tokenString: string, secret: string) {
    let decoded: payload;

    try {
        decoded = jwt.verify(tokenString, secret) as JwtPayload;
    } catch (e) {
        throw new UnauthorizedError("Invalid token");
    }

    if (decoded.iss !== TOKEN_ISSUER) {
        throw new UnauthorizedError("Invalid issuer");
    }

    if (!decoded.sub) {
        throw new UnauthorizedError("No user ID in the token");
    }

    return decoded.sub;
}

export function getBearerToken(req: Request): string {
    const header = req.get('Authorization');
    if (!header) {
        throw new UnauthorizedError("Authorization missing");
    }
    return header.replace("Bearer ", "");
}
