import {
  generateAccessToken,
  generateRefreshToken,
  getAccessExpiry,
  getRefreshExpiry,
  verifyRefreshToken,
} from "@/lib/auth";
import sql from "@/lib/db";
import { preflight } from "@/lib/middleware";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({ refreshToken: z.string().min(1).max(4096) });

export async function OPTIONS() {
  return preflight();
}

// O front guarda o access token só em memória: toda recarga de página passa
// por aqui para obter um novo par de tokens.
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

  // Rotação atômica: só uma requisição consegue revogar (e usar) o token.
  const [row] = await sql`
    UPDATE refresh_tokens SET revoked_at = NOW()
    WHERE token = ${refreshToken}
      AND user_id = ${payload.sub}
      AND revoked_at IS NULL
      AND expires_at > NOW()
    RETURNING id
  `;

  if (!row) {
    // Possível reuso de token – revoga todas as sessões do usuário.
    await sql`
      UPDATE refresh_tokens SET revoked_at = NOW()
      WHERE user_id = ${payload.sub} AND revoked_at IS NULL
    `;
    return NextResponse.json(
      { message: "Token inválido ou reutilizado." },
      { status: 401 },
    );
  }

  const newAccessToken = generateAccessToken(payload.sub);
  const newRefreshToken = generateRefreshToken(payload.sub);

  await sql`
    INSERT INTO refresh_tokens (user_id, token, expires_at)
    VALUES (${payload.sub}, ${newRefreshToken}, ${getRefreshExpiry()})
  `;

  return NextResponse.json({
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    expiresAt: getAccessExpiry(),
  });
}
