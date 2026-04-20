import sql from "@/lib/db";
import { sendConfirmationEmail } from "@/lib/mailer";
import { preflight, rateLimit, requireAuth } from "@/lib/middleware";
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

export async function OPTIONS() {
  return preflight();
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const ip = req.headers.get("x-forwarded-for") || "unknown";
  if (!rateLimit(`resend:${userId}:${ip}`, 3, 60 * 60 * 1000)) {
    return NextResponse.json(
      { message: "Muitas tentativas. Aguarde antes de solicitar novamente." },
      { status: 429 },
    );
  }

  const [user] =
    await sql`SELECT email, email_confirmed FROM users WHERE id = ${userId}`;
  if (!user)
    return NextResponse.json(
      { message: "Usuário não encontrado." },
      { status: 404 },
    );
  if (user.email_confirmed) {
    return NextResponse.json({ message: "E-mail já confirmado." });
  }

  // Invalidate previous tokens
  await sql`
    UPDATE email_tokens SET used = TRUE
    WHERE user_id = ${userId} AND type = 'confirm' AND used = FALSE
  `;

  const token = uuidv4();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await sql`
    INSERT INTO email_tokens (user_id, token, type, expires_at)
    VALUES (${userId}, ${token}, 'confirm', ${expires.toISOString()})
  `;

  try {
    await sendConfirmationEmail(user.email, token);
  } catch (e) {
    console.error("Email error:", e);
  }

  return NextResponse.json({ message: "E-mail de confirmação reenviado!" });
}
