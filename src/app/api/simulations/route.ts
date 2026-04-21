import sql from "@/lib/db";
import { preflight, rateLimit, requireAuth } from "@/lib/middleware";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["simples", "composta"]),
  principal: z.number().nonnegative().max(1_000_000_000),
  rate: z.number().positive().max(10000),
  period: z.number().int().positive().max(1200),
  periodUnit: z.enum(["mensal", "anual"]).default("mensal"),
  contribution: z.number().nonnegative().max(1_000_000_000).default(0),
  contributionFrequency: z.enum(["mensal", "anual"]).default("mensal"),
});

function calc(
  type: "simples" | "composta",
  principal: number, rate: number, period: number,
  periodUnit: "mensal" | "anual",
  contribution: number, contributionFreq: "mensal" | "anual"
) {
  const months = periodUnit === "anual" ? period * 12 : period;
  const monthlyRate = periodUnit === "anual"
    ? (type === "composta" ? Math.pow(1 + rate / 100, 1 / 12) - 1 : rate / 100 / 12)
    : rate / 100;
  const monthlyContrib = contributionFreq === "anual" ? contribution / 12 : contribution;

  let finalAmount: number;
  if (type === "simples") {
    const principalFinal = principal * (1 + monthlyRate * months);
    const totalContribs = monthlyContrib * months;
    const contribInterest = (monthlyContrib * months * (monthlyRate * months)) / 2;
    finalAmount = principalFinal + totalContribs + contribInterest;
  } else {
    if (monthlyRate === 0) {
      finalAmount = principal + monthlyContrib * months;
    } else {
      finalAmount =
        principal * Math.pow(1 + monthlyRate, months) +
        monthlyContrib * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
    }
  }

  const totalInvested = principal + monthlyContrib * months;
  return {
    finalAmount: Math.round(finalAmount * 100) / 100,
    totalInvested: Math.round(totalInvested * 100) / 100,
    profit: Math.round((finalAmount - totalInvested) * 100) / 100,
  };
}

function mapRow(r: Record<string, unknown>) {
  return {
    id: r.id, name: r.name, type: r.type,
    principal: parseFloat(r.principal as string),
    rate: parseFloat(r.rate as string),
    period: r.period,
    periodUnit: r.period_unit,
    contribution: parseFloat((r.contribution as string) ?? "0"),
    contributionFrequency: r.contribution_frequency,
    finalAmount: parseFloat(r.final_amount as string),
    totalInvested: parseFloat(r.total_invested as string),
    profit: parseFloat(r.profit as string),
    createdAt: r.created_at,
  };
}

export async function OPTIONS() { return preflight(); }

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  const rows = await sql`
    SELECT id, name, type, principal, rate, period, period_unit,
           contribution, contribution_frequency, final_amount, total_invested, profit, created_at
    FROM simulations WHERE user_id = ${userId} ORDER BY created_at DESC
  `;
  return NextResponse.json(rows.map(mapRow));
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const ip = req.headers.get("x-forwarded-for") || "unknown";
  if (!rateLimit(`sim:${userId}:${ip}`, 100, 3600000)) {
    return NextResponse.json({ message: "Muitas operações. Tente mais tarde." }, { status: 429 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ message: "Payload inválido." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados inválidos.", errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  const { name, type, principal, rate, period, periodUnit, contribution, contributionFrequency } = parsed.data;
  const { finalAmount, totalInvested, profit } = calc(type, principal, rate, period, periodUnit, contribution, contributionFrequency);

  const [row] = await sql`
    INSERT INTO simulations
      (user_id, name, type, principal, rate, period, period_unit, contribution, contribution_frequency, final_amount, total_invested, profit)
    VALUES
      (${userId}, ${name}, ${type}, ${principal}, ${rate}, ${period}, ${periodUnit}, ${contribution}, ${contributionFrequency}, ${finalAmount}, ${totalInvested}, ${profit})
    RETURNING id, name, type, principal, rate, period, period_unit, contribution, contribution_frequency, final_amount, total_invested, profit, created_at
  `;
  return NextResponse.json(mapRow(row), { status: 201 });
}
