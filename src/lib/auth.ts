import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const ACCESS_EXPIRES = "15m";
const REFRESH_EXPIRES = "7d";

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateAccessToken(userId: string): string {
  return jwt.sign({ sub: userId, type: "access" }, ACCESS_SECRET, {
    expiresIn: ACCESS_EXPIRES,
  });
}

export function generateRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId, type: "refresh" }, REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRES,
  });
}

export function verifyAccessToken(token: string): { sub: string } {
  return jwt.verify(token, ACCESS_SECRET) as { sub: string };
}

export function verifyRefreshToken(token: string): { sub: string } {
  return jwt.verify(token, REFRESH_SECRET) as { sub: string };
}

export function getAccessExpiry(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 15);
  return d.toISOString();
}
