import sql from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/mailer";
import { preflight, rateLimit } from "@/lib/middleware";
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

const schema = z.object({ email: z.string().email() });

export async function OPTIONS() {
  return preflight();
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  if (!rateLimit(`forgot:${ip}`, 5, 15 * 60 * 1000)) {
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
  // Always respond the same to prevent email enumeration
  const GENERIC = {
    message:
      "Se este e-mail estiver cadastrado, você receberá as instruções em breve.",
  };

  if (!parsed.success) return NextResponse.json(GENERIC);

  const { email } = parsed.data;
  const [user] = await sql`SELECT id FROM users WHERE email = ${email}`;
  if (!user) return NextResponse.json(GENERIC);

  // Invalidate previous reset tokens
  await sql`
    UPDATE email_tokens SET used = TRUE
    WHERE user_id = ${user.id} AND type = 'reset' AND used = FALSE
  `;

  const token = uuidv4();
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1h

  await sql`
    INSERT INTO email_tokens (user_id, token, type, expires_at)
    VALUES (${user.id}, ${token}, 'reset', ${expires.toISOString()})
  `;

  try {
    await sendPasswordResetEmail(email, token);
  } catch (e) {
    console.error("Email error:", e);
  }

  return NextResponse.json(GENERIC);
}
