import sql from "@/lib/db";
import { preflight, rateLimit, requireAuth } from "@/lib/middleware";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const assetSchema = z.object({
  ticker: z.string().min(1).max(20).transform((v) => v.toUpperCase()),
  name: z.string().min(1).max(150),
  type: z.enum(["acao", "fii", "etf", "stock", "renda_fixa"]),
  quantity: z.number().positive(),
  avgPrice: z.number().positive(),
  contributions: z.number().nonnegative().default(0),
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

export async function OPTIONS() { return preflight(); }

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const rows = await sql`
    SELECT id, ticker, name, type, quantity, avg_price, contributions, created_at, updated_at
    FROM portfolio
    WHERE user_id = ${userId}
    ORDER BY type, ticker
  `;
  return NextResponse.json(rows.map(mapRow));
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const ip = req.headers.get("x-forwarded-for") || "unknown";
  if (!rateLimit(`portfolio:${userId}:${ip}`, 200, 3600000)) {
    return NextResponse.json({ message: "Muitas operações. Tente mais tarde." }, { status: 429 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ message: "Payload inválido." }, { status: 400 });
  }

  const parsed = assetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados inválidos.", errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  const { ticker, name, type, quantity, avgPrice, contributions } = parsed.data;

  const [existing] = await sql`SELECT id FROM portfolio WHERE user_id = ${userId} AND ticker = ${ticker}`;
  if (existing) {
    return NextResponse.json({ message: "Ativo já existe na carteira. Use edição para atualizar." }, { status: 409 });
  }

  const [row] = await sql`
    INSERT INTO portfolio (user_id, ticker, name, type, quantity, avg_price, contributions)
    VALUES (${userId}, ${ticker}, ${name}, ${type}, ${quantity}, ${avgPrice}, ${contributions})
    RETURNING id, ticker, name, type, quantity, avg_price, contributions, created_at, updated_at
  `;
  return NextResponse.json(mapRow(row), { status: 201 });
}
