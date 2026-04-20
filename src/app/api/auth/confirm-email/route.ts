import sql from "@/lib/db";
import { preflight } from "@/lib/middleware";
import { NextRequest, NextResponse } from "next/server";

export async function OPTIONS() {
  return preflight();
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const email = searchParams.get("email");

  if (!token || !email) {
    return NextResponse.json(
      { message: "Parâmetros ausentes." },
      { status: 400 },
    );
  }

  const [row] = await sql`
    SELECT et.id, et.user_id FROM email_tokens et
    JOIN users u ON u.id = et.user_id
    WHERE et.token = ${token}
      AND u.email = ${email}
      AND et.type = 'confirm'
      AND et.used = FALSE
      AND et.expires_at > NOW()
  `;

  if (!row) {
    return NextResponse.json(
      { message: "Link inválido ou expirado." },
      { status: 400 },
    );
  }

  await sql`UPDATE users SET email_confirmed = TRUE WHERE id = ${row.user_id}`;
  await sql`UPDATE email_tokens SET used = TRUE WHERE id = ${row.id}`;

  return NextResponse.json({ message: "E-mail confirmado com sucesso!" });
}
