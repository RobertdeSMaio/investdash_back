import { comparePassword, hashPassword } from "@/lib/auth";
import sql from "@/lib/db";
import { preflight, rateLimit, requireAuth } from "@/lib/middleware";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const schema = z
  .object({
    currentPassword: z.string().min(1),
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

  const ip = req.headers.get("x-forwarded-for") || "unknown";
  if (!rateLimit(`changepw:${userId}:${ip}`, 5, 15 * 60 * 1000)) {
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
  await sql`UPDATE users SET password = ${hashed} WHERE id = ${userId}`;

  // Revoke all refresh tokens except current session would require passing token; revoke all for safety
  await sql`UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = ${userId}`;

  return NextResponse.json({
    message: "Senha alterada com sucesso! Faça login novamente.",
  });
}
