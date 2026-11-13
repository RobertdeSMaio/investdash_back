import {
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  getAccessExpiry,
  getRefreshExpiry,
} from "@/lib/auth";
import sql from "@/lib/db";
import { clientIp, preflight, rateLimit } from "@/lib/middleware";
import { anyPassword, email } from "@/lib/validation";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  email,
  password: anyPassword,
});

// Hash bcrypt válido (custo 12) de um valor aleatório descartado: mantém o
// tempo de resposta igual quando o e-mail não existe.
const DUMMY_HASH =
  "$2a$12$TxR5et91ebKoaQSKJbuK1.XiNIVwNviRqLpCkR7NKVlTIi7o25eWO";

export async function OPTIONS() {
  return preflight();
}

export async function POST(req: NextRequest) {
  if (!rateLimit(`login:${clientIp(req)}`, 10, 10 * 60 * 1000)) {
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

  // Generic message to avoid timing attacks / email enumeration
  const GENERIC = "E-mail ou senha incorretos.";

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: GENERIC }, { status: 401 });
  }

  const { email: address, password } = parsed.data;

  const [user] = await sql`
    SELECT id, name, email, password, email_confirmed, created_at
    FROM users WHERE email = ${address}
  `;

  if (!user) {
    await comparePassword(password, DUMMY_HASH);
    return NextResponse.json({ message: GENERIC }, { status: 401 });
  }

  const valid = await comparePassword(password, user.password);
  if (!valid) {
    return NextResponse.json({ message: GENERIC }, { status: 401 });
  }

  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken(user.id);

  await sql`
    INSERT INTO refresh_tokens (user_id, token, expires_at)
    VALUES (${user.id}, ${refreshToken}, ${getRefreshExpiry()})
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
