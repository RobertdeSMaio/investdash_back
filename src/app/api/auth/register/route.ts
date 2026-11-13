import { hashPassword } from "@/lib/auth";
import sql from "@/lib/db";
import { sendConfirmationEmail } from "@/lib/mailer";
import {
  clientIp,
  isUniqueViolation,
  preflight,
  rateLimit,
} from "@/lib/middleware";
import { email, invalid, personName, strongPassword } from "@/lib/validation";
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

const schema = z
  .object({
    name: personName,
    email,
    password: strongPassword,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Senhas não conferem",
    path: ["confirmPassword"],
  });

const DUPLICATE = { message: "Este e-mail já está cadastrado." };

export async function OPTIONS() {
  return preflight();
}

export async function POST(req: NextRequest) {
  if (!rateLimit(`register:${clientIp(req)}`, 10, 60 * 60 * 1000)) {
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
    return NextResponse.json(invalid(parsed.error), { status: 422 });
  }

  const { name, email: address, password } = parsed.data;

  const [existing] = await sql`SELECT id FROM users WHERE email = ${address}`;
  if (existing) {
    return NextResponse.json(DUPLICATE, { status: 409 });
  }

  const hashed = await hashPassword(password);

  let user: Record<string, unknown>;
  try {
    [user] = await sql`
      INSERT INTO users (name, email, password)
      VALUES (${name}, ${address}, ${hashed})
      RETURNING id, email
    `;
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json(DUPLICATE, { status: 409 });
    }
    throw err;
  }

  const token = uuidv4();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await sql`
    INSERT INTO email_tokens (user_id, token, type, expires_at)
    VALUES (${user.id as string}, ${token}, 'confirm', ${expires.toISOString()})
  `;

  try {
    await sendConfirmationEmail(address, token);
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
