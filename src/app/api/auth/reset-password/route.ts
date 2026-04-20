import { hashPassword } from "@/lib/auth";
import sql from "@/lib/db";
import { preflight, rateLimit } from "@/lib/middleware";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const schema = z
  .object({
    token: z.string().min(1),
    email: z.string().email(),
    newPassword: z
      .string()
      .min(8)
      .max(128)
      .regex(/[A-Z]/, "Deve conter ao menos uma letra maiúscula")
      .regex(/[0-9]/, "Deve conter ao menos um número"),
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
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  if (!rateLimit(`reset:${ip}`, 10, 15 * 60 * 1000)) {
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
    return NextResponse.json(
      {
        message: "Dados inválidos.",
        errors: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    );
  }

  const { token, email, newPassword } = parsed.data;

  const [row] = await sql`
    SELECT et.id, et.user_id FROM email_tokens et
    JOIN users u ON u.id = et.user_id
    WHERE et.token = ${token}
      AND u.email = ${email}
      AND et.type = 'reset'
      AND et.used = FALSE
      AND et.expires_at > NOW()
  `;

  if (!row) {
    return NextResponse.json(
      { message: "Link inválido ou expirado." },
      { status: 400 },
    );
  }

  const hashed = await hashPassword(newPassword);
  await sql`UPDATE users SET password = ${hashed} WHERE id = ${row.user_id}`;
  await sql`UPDATE email_tokens SET used = TRUE WHERE id = ${row.id}`;

  // Revoke all refresh tokens (force re-login after password reset)
  await sql`UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = ${row.user_id}`;

  return NextResponse.json({
    message: "Senha redefinida com sucesso! Faça login.",
  });
}
