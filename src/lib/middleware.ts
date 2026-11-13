import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "./auth";
import { corsHeaders } from "./cors";

export function getAuthUser(req: NextRequest): string | null {
  try {
    const header = req.headers.get("authorization") || "";
    if (!header.startsWith("Bearer ")) return null;
    const token = header.slice(7);
    const payload = verifyAccessToken(token);
    return payload.sub;
  } catch {
    return null;
  }
}

export function requireAuth(
  req: NextRequest,
): { userId: string } | NextResponse {
  const userId = getAuthUser(req);
  if (!userId) {
    return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  }
  return { userId };
}

// x-forwarded-for pode vir como lista "cliente, proxy1, proxy2".
export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) return false;

  entry.count++;
  return true;
}

export function preflight() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

// Código de erro do Postgres para violação de UNIQUE.
export function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === "23505";
}
