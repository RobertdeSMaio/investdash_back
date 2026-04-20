import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "./auth";

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

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://investdash.vercel.app",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
};

export function preflight() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export function corsResponse(res: NextResponse) {
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.headers.set(key, value);
  });
  return res;
}
