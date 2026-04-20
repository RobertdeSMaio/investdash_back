import sql from "@/lib/db";
import { preflight, requireAuth } from "@/lib/middleware";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(2).max(100),
});

export async function OPTIONS() {
  return preflight();
}

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const [user] = await sql`
    SELECT id, name, email, email_confirmed, created_at
    FROM users WHERE id = ${userId}
  `;
  if (!user)
    return NextResponse.json(
      { message: "Usuário não encontrado." },
      { status: 404 },
    );

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    emailConfirmed: user.email_confirmed,
    createdAt: user.created_at,
  });
}

export async function PUT(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Payload inválido." }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Dados inválidos.",
        errors: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    );
  }

  const [user] = await sql`
    UPDATE users SET name = ${parsed.data.name}
    WHERE id = ${userId}
    RETURNING id, name, email, email_confirmed, created_at
  `;

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    emailConfirmed: user.email_confirmed,
    createdAt: user.created_at,
  });
}
