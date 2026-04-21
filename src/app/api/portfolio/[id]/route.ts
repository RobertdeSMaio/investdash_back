import sql from "@/lib/db";
import { preflight, requireAuth } from "@/lib/middleware";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  quantity: z.number().positive().optional(),
  avgPrice: z.number().positive().optional(),
  contributions: z.number().nonnegative().optional(),
});

function mapRow(r: Record<string, unknown>) {
  return {
    id: r.id,
    ticker: r.ticker,
    name: r.name,
    type: r.type,
    quantity: parseFloat(r.quantity as string),
    avgPrice: parseFloat(r.avg_price as string),
    contributions: parseFloat((r.contributions as string) ?? "0"),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const validId = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

export async function OPTIONS() { return preflight(); }

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  const { id } = await context.params;
  if (!validId(id)) return NextResponse.json({ message: "ID inválido." }, { status: 400 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ message: "Payload inválido." }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados inválidos.", errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  const { quantity, avgPrice, contributions, name } = parsed.data;

  const [row] = await sql`
    UPDATE portfolio SET
      quantity     = COALESCE(${quantity ?? null}, quantity),
      avg_price    = COALESCE(${avgPrice ?? null}, avg_price),
      contributions= COALESCE(${contributions ?? null}, contributions),
      name         = COALESCE(${name ?? null}, name),
      updated_at   = NOW()
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING id, ticker, name, type, quantity, avg_price, contributions, created_at, updated_at
  `;

  if (!row) return NextResponse.json({ message: "Ativo não encontrado." }, { status: 404 });
  return NextResponse.json(mapRow(row));
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  const { id } = await context.params;
  if (!validId(id)) return NextResponse.json({ message: "ID inválido." }, { status: 400 });

  const result = await sql`DELETE FROM portfolio WHERE id = ${id} AND user_id = ${userId} RETURNING id`;
  if (!result.length) return NextResponse.json({ message: "Ativo não encontrado." }, { status: 404 });
  return NextResponse.json({ message: "Ativo removido da carteira." });
}
