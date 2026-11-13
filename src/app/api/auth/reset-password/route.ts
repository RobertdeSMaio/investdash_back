import { hashPassword } from "@/lib/auth";
import sql from "@/lib/db";
import { clientIp, preflight, rateLimit } from "@/lib/middleware";
import { email, invalid, strongPassword } from "@/lib/validation";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const schema = z
  .object({
    token: z.string().trim().min(1).max(2048),
    email,
    newPassword: strongPassword,
    confirmNewPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmNewPassword, {
    message: "Senhas não conferem",
    path: ["confirmNewPassword"],
  });

export async function OPTIONS() {
  return preflight();
}

export async function POST(req: NextRequest) {
  if (!rateLimit(`reset:${clientIp(req)}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json(
      { message: "Muitas tentativas." },
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
    return NextResponse.json(invalid(parsed.error), { status: 422 });
  }

  const { token, email: address, newPassword } = parsed.data;

  // Hash antes de consumir o token: se falhar, o link continua válido.
  const hashed = await hashPassword(newPassword);

  // Consome o token de forma atômica (evita duplo uso).
  const [row] = await sql`
    UPDATE email_tokens et SET used_at = NOW()
    FROM users u
    WHERE u.id = et.user_id
      AND et.token = ${token}
      AND u.email = ${address}
      AND et.type = 'reset'
      AND et.used_at IS NULL
      AND et.expires_at > NOW()
    RETURNING et.user_id
  `;

  if (!row) {
    return NextResponse.json(
      { message: "Link inválido ou expirado." },
      { status: 400 },
    );
  }

  await sql`
    UPDATE users SET password = ${hashed}, updated_at = NOW()
    WHERE id = ${row.user_id}
  `;

  // Revoke all refresh tokens (force re-login after password reset)
  await sql`
    UPDATE refresh_tokens SET revoked_at = NOW()
    WHERE user_id = ${row.user_id} AND revoked_at IS NULL
  `;

  return NextResponse.json({
    message: "Senha redefinida com sucesso! Faça login.",
  });
}
