import sql from "@/lib/db";
import { isUniqueViolation, preflight, requireAuth } from "@/lib/middleware";
import { DUPLICATE_TICKER_MESSAGE, mapAsset } from "@/lib/portfolio";
import { assetSchema, invalid } from "@/lib/validation";
import { NextRequest, NextResponse } from "next/server";

// O modal de edição do front envia o ativo completo (inclusive ticker e tipo),
// mas todos os campos continuam opcionais para atualizações parciais.
const updateSchema = assetSchema.partial().extend({
  contributions: assetSchema.shape.contributions.removeDefault().optional(),
});

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
    return NextResponse.json(invalid(parsed.error), { status: 422 });
  }

  const { ticker, name, type, quantity, avgPrice, contributions } = parsed.data;

  try {
    const [row] = await sql`
      UPDATE portfolio SET
        ticker        = COALESCE(${ticker ?? null}, ticker),
        name          = COALESCE(${name ?? null}, name),
        type          = COALESCE(${type ?? null}, type),
        quantity      = COALESCE(${quantity ?? null}, quantity),
        avg_price     = COALESCE(${avgPrice ?? null}, avg_price),
        contributions = COALESCE(${contributions ?? null}, contributions),
        updated_at    = NOW()
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING id, ticker, name, type, quantity, avg_price, contributions, created_at, updated_at
    `;

    if (!row) return NextResponse.json({ message: "Ativo não encontrado." }, { status: 404 });
    return NextResponse.json(mapAsset(row));
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json({ message: DUPLICATE_TICKER_MESSAGE }, { status: 409 });
    }
    throw err;
  }
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
