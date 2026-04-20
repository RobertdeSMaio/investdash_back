import sql from "@/lib/db";
import { preflight, requireAuth } from "@/lib/middleware";
import { NextRequest, NextResponse } from "next/server";

export async function OPTIONS() {
  return preflight();
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const { id } = params;

  // UUID basic validation to prevent injection
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ message: "ID inválido." }, { status: 400 });
  }

  const result = await sql`
    DELETE FROM investments
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING id
  `;

  if (result.length === 0) {
    return NextResponse.json(
      { message: "Investimento não encontrado." },
      { status: 404 },
    );
  }

  return NextResponse.json({ message: "Investimento removido." });
}
