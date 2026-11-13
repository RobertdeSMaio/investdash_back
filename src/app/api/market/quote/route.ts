import { clientIp, preflight, rateLimit, requireAuth } from "@/lib/middleware";
import { TICKER_REGEX } from "@/lib/validation";
import { NextRequest, NextResponse } from "next/server";

// Proxy da brapi.dev: o token (BRAPI_TOKEN) fica só no servidor.
// Sem token a brapi responde apenas tickers de teste (PETR4, VALE3, MGLU3, ITUB4).

const BRAPI_URL = "https://brapi.dev/api/quote/";
const RANGES = ["1mo", "3mo", "6mo", "1y"] as const;
const QUOTE_TTL = 60 * 1000;
const HISTORY_TTL = 10 * 60 * 1000;
const MAX_CACHE = 2000;
const TIMEOUT_MS = 10000;

type Entry = { at: number; ttl: number; status: number; body: unknown };
const cache = new Map<string, Entry>();

function remember(key: string, entry: Entry) {
  if (cache.size >= MAX_CACHE) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, entry);
}

export async function OPTIONS() {
  return preflight();
}

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  if (!rateLimit(`market:${userId}:${clientIp(req)}`, 600, 60 * 60 * 1000)) {
    return NextResponse.json(
      { message: "Muitas consultas. Tente novamente mais tarde." },
      { status: 429 },
    );
  }

  const { searchParams } = new URL(req.url);
  const ticker = (searchParams.get("ticker") ?? "").trim().toUpperCase();
  const range = searchParams.get("range");

  if (!TICKER_REGEX.test(ticker)) {
    return NextResponse.json({ message: "Ticker inválido." }, { status: 422 });
  }
  if (range !== null && !(RANGES as readonly string[]).includes(range)) {
    return NextResponse.json({ message: "Período inválido." }, { status: 422 });
  }

  const key = `${ticker}:${range ?? "quote"}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) {
    return NextResponse.json(hit.body, { status: hit.status });
  }

  const params = new URLSearchParams({ fundamental: "false" });
  if (range) {
    params.set("range", range);
    params.set("interval", "1d");
  }

  const token = process.env.BRAPI_TOKEN?.trim();
  let res: Response;
  try {
    res = await fetch(`${BRAPI_URL}${encodeURIComponent(ticker)}?${params}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return NextResponse.json({ message: "Serviço de cotações indisponível." }, { status: 502 });
  }

  if (res.status === 404) {
    const body = { message: "Ticker não encontrado." };
    remember(key, { at: Date.now(), ttl: HISTORY_TTL, status: 404, body });
    return NextResponse.json(body, { status: 404 });
  }
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      console.error(`brapi ${res.status} para ${ticker} (BRAPI_TOKEN ${token ? "inválido ou sem acesso" : "não configurado"})`);
    }
    return NextResponse.json({ message: "Cotação indisponível." }, { status: 502 });
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return NextResponse.json({ message: "Cotação indisponível." }, { status: 502 });
  }

  // Repassa só o primeiro resultado, com os campos que o front usa.
  const item = ((json as { results?: unknown[] })?.results ?? [])[0] as
    | Record<string, unknown>
    | undefined;
  if (!item) {
    return NextResponse.json({ message: "Cotação indisponível." }, { status: 502 });
  }

  const pick = (k: string) => item[k];
  const body = {
    results: [
      {
        symbol: pick("symbol"),
        shortName: pick("shortName"),
        longName: pick("longName"),
        currency: pick("currency"),
        regularMarketPrice: pick("regularMarketPrice"),
        regularMarketChange: pick("regularMarketChange"),
        regularMarketChangePercent: pick("regularMarketChangePercent"),
        regularMarketDayHigh: pick("regularMarketDayHigh"),
        regularMarketDayLow: pick("regularMarketDayLow"),
        regularMarketTime: pick("regularMarketTime"),
        ...(range ? { historicalDataPrice: pick("historicalDataPrice") } : {}),
      },
    ],
  };

  remember(key, { at: Date.now(), ttl: range ? HISTORY_TTL : QUOTE_TTL, status: 200, body });
  return NextResponse.json(body);
}
