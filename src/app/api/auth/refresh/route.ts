import {
  generateAccessToken,
  generateRefreshToken,
  getAccessExpiry,
  verifyRefreshToken,
} from "@/lib/auth";
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
    return NextResponse.json({ message: "Payload inválido." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Token inválido." }, { status: 401 });
  }

  const { refreshToken } = parsed.data;

  let payload: { sub: string };
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    return NextResponse.json(
      { message: "Token expirado ou inválido." },
      { status: 401 },
    );
  }

  // Validate token in DB (rotation + revocation check)
  const [row] = await sql`
    SELECT id, user_id FROM refresh_tokens
    WHERE token = ${refreshToken}
      AND user_id = ${payload.sub}
      AND revoked = FALSE
      AND expires_at > NOW()
  `;

  if (!row) {
    // Potential token reuse – revoke all tokens for this user (breach detection)
    await sql`UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = ${payload.sub}`;
    return NextResponse.json(
      { message: "Token inválido ou reutilizado." },
      { status: 401 },
    );
  }

  // Rotate: revoke old, issue new
  await sql`UPDATE refresh_tokens SET revoked = TRUE WHERE id = ${row.id}`;

  const newAccessToken = generateAccessToken(payload.sub);
  const newRefreshToken = generateRefreshToken(payload.sub);
  const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await sql`
    INSERT INTO refresh_tokens (user_id, token, expires_at)
    VALUES (${payload.sub}, ${newRefreshToken}, ${newExpiry.toISOString()})
  `;

  return NextResponse.json({
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    expiresAt: getAccessExpiry(),
  });
}
