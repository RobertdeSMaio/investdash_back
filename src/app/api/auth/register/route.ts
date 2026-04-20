import { hashPassword } from "@/lib/auth";
import sql from "@/lib/db";
import { sendConfirmationEmail } from "@/lib/mailer";
import { preflight, rateLimit } from "@/lib/middleware";
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

const schema = z
  .object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
    password: z
      .string()
      .min(8)
      .max(128)
      .regex(/[A-Z]/, "Deve conter ao menos uma letra maiúscula")
      .regex(/[0-9]/, "Deve conter ao menos um número")
      .regex(/[^A-Za-z0-9]/, "Deve conter ao menos um caractere especial"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Senhas não conferem",
    path: ["confirmPassword"],
  });

export async function OPTIONS() {
  return preflight();
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  if (!rateLimit(`register:${ip}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json(
      { message: "Muitas tentativas. Tente novamente mais tarde." },
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

  const { name, email, password } = parsed.data;

  const [existing] = await sql`SELECT id FROM users WHERE email = ${email}`;
  if (existing) {
    return NextResponse.json(
      { message: "Este e-mail já está cadastrado." },
      { status: 409 },
    );
  }

  const hashed = await hashPassword(password);

  const [user] = await sql`
    INSERT INTO users (name, email, password)
    VALUES (${name}, ${email}, ${hashed})
    RETURNING id, email
  `;

  const token = uuidv4();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await sql`
    INSERT INTO email_tokens (user_id, token, type, expires_at)
    VALUES (${user.id}, ${token}, 'confirm', ${expires.toISOString()})
  `;

  try {
    await sendConfirmationEmail(email, token);
  } catch (e) {
    console.error("Email error:", e);
  }

  return NextResponse.json(
    {
      message: "Conta criada! Verifique seu e-mail para confirmar o cadastro.",
    },
    { status: 201 },
  );
}
