import sql from "@/lib/db";
import { clientIp, preflight, rateLimit } from "@/lib/middleware";
import { NextRequest, NextResponse } from "next/server";

export async function OPTIONS() {
  return preflight();
}

const INVALID = { message: "Link inválido ou expirado." };

export async function GET(req: NextRequest) {
  if (!rateLimit(`confirm:${clientIp(req)}`, 20, 15 * 60 * 1000)) {
    return NextResponse.json(
      { message: "Muitas tentativas. Tente novamente em breve." },
      { status: 429 },
    );
  }

  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token")?.trim();
  const email = searchParams.get("email")?.trim();

  if (!token || !email || token.length > 2048 || email.length > 254) {
    return NextResponse.json(INVALID, { status: 400 });
  }

  // Marca o token como usado de forma atômica (evita duplo consumo).
  const [row] = await sql`
    UPDATE email_tokens et SET used_at = NOW()
    FROM users u
    WHERE u.id = et.user_id
      AND et.token = ${token}
      AND u.email = ${email}
      AND et.type = 'confirm'
      AND et.used_at IS NULL
      AND et.expires_at > NOW()
    RETURNING et.user_id
  `;

  if (!row) {
    return NextResponse.json(INVALID, { status: 400 });
  }

  await sql`
    UPDATE users SET email_confirmed = TRUE, updated_at = NOW()
    WHERE id = ${row.user_id}
  `;

  return NextResponse.json({ message: "E-mail confirmado com sucesso!" });
}
