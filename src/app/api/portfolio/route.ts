import sql from "@/lib/db";
import {
  clientIp,
  isUniqueViolation,
  preflight,
  rateLimit,
  requireAuth,
} from "@/lib/middleware";
import { DUPLICATE_TICKER_MESSAGE, mapAsset } from "@/lib/portfolio";
import { assetSchema, invalid } from "@/lib/validation";
import { NextRequest, NextResponse } from "next/server";

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
  return NextResponse.json(rows.map(mapAsset));
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  if (!rateLimit(`portfolio:${userId}:${clientIp(req)}`, 200, 3600000)) {
    return NextResponse.json({ message: "Muitas operações. Tente mais tarde." }, { status: 429 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ message: "Payload inválido." }, { status: 400 });
  }

  const parsed = assetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(invalid(parsed.error), { status: 422 });
  }

  const { ticker, name, type, quantity, avgPrice, contributions } = parsed.data;

  try {
    const [row] = await sql`
      INSERT INTO portfolio (user_id, ticker, name, type, quantity, avg_price, contributions)
      VALUES (${userId}, ${ticker}, ${name}, ${type}, ${quantity}, ${avgPrice}, ${contributions})
      RETURNING id, ticker, name, type, quantity, avg_price, contributions, created_at, updated_at
    `;
    return NextResponse.json(mapAsset(row), { status: 201 });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json({ message: DUPLICATE_TICKER_MESSAGE }, { status: 409 });
    }
    throw err;
  }
}
