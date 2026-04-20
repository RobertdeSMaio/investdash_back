import sql from "@/lib/db";
import { preflight, rateLimit, requireAuth } from "@/lib/middleware";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["simples", "composta"]),
  principal: z.number().positive().max(1_000_000_000),
  rate: z.number().positive().max(1000), // % per period
  period: z.number().int().positive().max(1200), // months
});

function calcFinalAmount(
  type: "simples" | "composta",
  principal: number,
  rate: number,
  period: number,
) {
  const r = rate / 100;
  if (type === "simples") {
    return principal * (1 + r * period);
  }
  return principal * Math.pow(1 + r, period);
}

export async function OPTIONS() {
  return preflight();
}

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const rows = await sql`
    SELECT id, name, type, principal, rate, period, final_amount, profit, created_at
    FROM investments
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      principal: parseFloat(r.principal),
      rate: parseFloat(r.rate),
      period: r.period,
      finalAmount: parseFloat(r.final_amount),
      profit: parseFloat(r.profit),
      createdAt: r.created_at,
    })),
  );
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  // Rate limit: max 100 investments created per hour per user
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  if (!rateLimit(`invest:create:${userId}:${ip}`, 100, 60 * 60 * 1000)) {
    return NextResponse.json(
      { message: "Muitas operações. Tente novamente mais tarde." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Payload inválido." }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Dados inválidos.",
        errors: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    );
  }

  const { name, type, principal, rate, period } = parsed.data;
  const finalAmount = calcFinalAmount(type, principal, rate, period);
  const profit = finalAmount - principal;

  const [row] = await sql`
    INSERT INTO investments (user_id, name, type, principal, rate, period, final_amount, profit)
    VALUES (${userId}, ${name}, ${type}, ${principal}, ${rate}, ${period}, ${finalAmount}, ${profit})
    RETURNING id, name, type, principal, rate, period, final_amount, profit, created_at
  `;

  return NextResponse.json(
    {
      id: row.id,
      name: row.name,
      type: row.type,
      principal: parseFloat(row.principal),
      rate: parseFloat(row.rate),
      period: row.period,
      finalAmount: parseFloat(row.final_amount),
      profit: parseFloat(row.profit),
      createdAt: row.created_at,
    },
    { status: 201 },
  );
}
