import sql from "@/lib/db";
import { preflight } from "@/lib/middleware";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({ refreshToken: z.string().min(1) });

export async function OPTIONS() {
  return preflight();
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "OK" }); // silent
  }

  const parsed = schema.safeParse(body);
  if (parsed.success) {
    await sql`
      UPDATE refresh_tokens SET revoked = TRUE
      WHERE token = ${parsed.data.refreshToken}
    `;
  }

  return NextResponse.json({ message: "Sessão encerrada." });
}
