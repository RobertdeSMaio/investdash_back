import { comparePassword, hashPassword } from "@/lib/auth";
import sql from "@/lib/db";
import { clientIp, preflight, rateLimit, requireAuth } from "@/lib/middleware";
import { anyPassword, invalid, strongPassword } from "@/lib/validation";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const schema = z
  .object({
    currentPassword: anyPassword,
    newPassword: strongPassword,
    confirmNewPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmNewPassword, {
    message: "Senhas não conferem",
    path: ["confirmNewPassword"],
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: "A nova senha deve ser diferente da atual",
    path: ["newPassword"],
  });

export async function OPTIONS() {
  return preflight();
}

export async function PUT(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  if (!rateLimit(`changepw:${userId}:${clientIp(req)}`, 5, 15 * 60 * 1000)) {
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

  const [user] = await sql`SELECT password FROM users WHERE id = ${userId}`;
  if (!user)
    return NextResponse.json(
      { message: "Usuário não encontrado." },
      { status: 404 },
    );

  const valid = await comparePassword(
    parsed.data.currentPassword,
    user.password,
  );
  if (!valid) {
    return NextResponse.json(
      { message: "Senha atual incorreta." },
      { status: 400 },
    );
  }

  const hashed = await hashPassword(parsed.data.newPassword);
  await sql`
    UPDATE users SET password = ${hashed}, updated_at = NOW()
    WHERE id = ${userId}
  `;

  // Revoga todas as sessões; a atual expira junto com o access token (15 min).
  await sql`
    UPDATE refresh_tokens SET revoked_at = NOW()
    WHERE user_id = ${userId} AND revoked_at IS NULL
  `;

  return NextResponse.json({
    message: "Senha alterada com sucesso! Faça login novamente.",
  });
}
