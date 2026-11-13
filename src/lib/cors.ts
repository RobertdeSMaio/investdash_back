// Sem imports do Next: este módulo também é usado pelo next.config.ts.

const DEFAULT_ORIGIN = "https://investdash.vercel.app";

// O front usa Bearer token (withCredentials: false), então não há cookies
// cross-site e "Access-Control-Allow-Credentials" não é necessário.
export const ALLOWED_ORIGIN = (process.env.ALLOWED_ORIGIN || DEFAULT_ORIGIN)
  .trim()
  .replace(/\/+$/, "");

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "600",
};

// Respostas da API carregam tokens e dados pessoais: nunca cachear.
export const apiSecurityHeaders: Record<string, string> = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};
