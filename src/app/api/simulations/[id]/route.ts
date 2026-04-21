import sql from "@/lib/db";
import { preflight, requireAuth } from "@/lib/middleware";
import { NextRequest, NextResponse } from "next/server";

export async function OPTIONS() { return preflight(); }

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  const { id } = await context.params;

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ message: "ID inválido." }, { status: 400 });
  }

  const result = await sql`
    DELETE FROM simulations WHERE id = ${id} AND user_id = ${userId} RETURNING id
  `;
  if (!result.length) return NextResponse.json({ message: "Simulação não encontrada." }, { status: 404 });
  return NextResponse.json({ message: "Simulação removida." });
}
