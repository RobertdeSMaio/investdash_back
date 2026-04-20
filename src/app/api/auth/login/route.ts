import {
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  getAccessExpiry,
} from "@/lib/auth";
import sql from "@/lib/db";
import { preflight, rateLimit } from "@/lib/middleware";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function OPTIONS() {
  return preflight();
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  if (!rateLimit(`login:${ip}`, 10, 10 * 60 * 1000)) {
    return NextResponse.json(
      { message: "Muitas tentativas. Tente novamente em breve." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Payload inválido." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "E-mail ou senha inválidos." },
      { status: 401 },
    );
  }

  const { email, password } = parsed.data;

  const [user] = await sql`
    SELECT id, name, email, password, email_confirmed, created_at
    FROM users WHERE email = ${email}
  `;

  // Generic message to avoid timing attacks / email enumeration
  const GENERIC = "E-mail ou senha incorretos.";

  if (!user) {
    // Still run bcrypt to prevent timing attacks
    await comparePassword(
      password,
      "$2b$12$dummyhashfortimingprotection00000000000000000000000000",
    );
    return NextResponse.json({ message: GENERIC }, { status: 401 });
  }

  const valid = await comparePassword(password, user.password);
  if (!valid) {
    return NextResponse.json({ message: GENERIC }, { status: 401 });
  }

  // Issue tokens
  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken(user.id);
  const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await sql`
    INSERT INTO refresh_tokens (user_id, token, expires_at)
    VALUES (${user.id}, ${refreshToken}, ${refreshExpiry.toISOString()})
  `;

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailConfirmed: user.email_confirmed,
      createdAt: user.created_at,
    },
    tokens: {
      accessToken,
      refreshToken,
      expiresAt: getAccessExpiry(),
    },
  });
}
