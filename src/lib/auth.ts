import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente ${name} não configurada.`);
  return value;
}

const ACCESS_EXPIRES = "15m";
const REFRESH_EXPIRES = "7d";
const ACCESS_TTL_MS = 15 * 60 * 1000;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateAccessToken(userId: string): string {
  return jwt.sign({ sub: userId, type: "access" }, requiredEnv("JWT_ACCESS_SECRET"), {
    expiresIn: ACCESS_EXPIRES,
    algorithm: "HS256",
  });
}

// jti garante unicidade: dois tokens emitidos no mesmo segundo para o mesmo
// usuário seriam idênticos e violariam o UNIQUE de refresh_tokens.token.
export function generateRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId, type: "refresh" }, requiredEnv("JWT_REFRESH_SECRET"), {
    expiresIn: REFRESH_EXPIRES,
    algorithm: "HS256",
    jwtid: randomUUID(),
  });
}

function verify(token: string, secret: string, type: "access" | "refresh"): { sub: string } {
  const payload = jwt.verify(token, secret, { algorithms: ["HS256"] });
  if (
    typeof payload !== "object" ||
    typeof payload.sub !== "string" ||
    (payload as { type?: unknown }).type !== type
  ) {
    throw new Error("Token inválido.");
  }
  return { sub: payload.sub };
}

export function verifyAccessToken(token: string): { sub: string } {
  return verify(token, requiredEnv("JWT_ACCESS_SECRET"), "access");
}

export function verifyRefreshToken(token: string): { sub: string } {
  return verify(token, requiredEnv("JWT_REFRESH_SECRET"), "refresh");
}

export function getAccessExpiry(): string {
  return new Date(Date.now() + ACCESS_TTL_MS).toISOString();
}

export function getRefreshExpiry(): string {
  return new Date(Date.now() + REFRESH_TTL_MS).toISOString();
}
