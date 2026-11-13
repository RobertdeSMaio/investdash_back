import { z } from "zod";

// Espelha investdash/src/utils/validationSchemas.ts — manter em sincronia.

export const LIMITS = {
  email: 254,
  name: 100,
  assetName: 150, // coluna portfolio.name (o front limita a 100)
  // bcrypt só considera os primeiros 72 bytes da senha.
  passwordBytes: 72,
  anyPassword: 128,
} as const;

// portfolio.quantity / avg_price são NUMERIC(18,6): até 12 dígitos inteiros.
export const MAX_ASSET_NUMBER = 999_999_999_999;
// O front permite até 1e12 em valores monetários.
export const MAX_MONEY = 1_000_000_000_000;

export const TICKER_REGEX = /^[A-Z0-9][A-Z0-9._+-]{0,19}$/;
const NO_MARKUP = /^[^<>{}]*$/;

export const email = z.string().trim().max(LIMITS.email).email();

export const personName = z
  .string()
  .trim()
  .min(2, "Nome muito curto")
  .max(LIMITS.name)
  .regex(NO_MARKUP, "Caracteres não permitidos");

// Senha informada para conferência (login, senha atual): sem regras de força.
export const anyPassword = z.string().min(1).max(LIMITS.anyPassword);

export const strongPassword = z
  .string()
  .min(8, "Mínimo 8 caracteres")
  .regex(/[a-z]/, "Deve conter ao menos uma letra minúscula")
  .regex(/[A-Z]/, "Deve conter ao menos uma letra maiúscula")
  .regex(/[0-9]/, "Deve conter ao menos um número")
  .regex(/[^A-Za-z0-9]/, "Deve conter ao menos um caractere especial")
  .refine(
    (v) => Buffer.byteLength(v, "utf8") <= LIMITS.passwordBytes,
    `Máximo ${LIMITS.passwordBytes} caracteres`,
  );

export const ASSET_TYPES = ["acao", "fii", "etf", "stock", "renda_fixa"] as const;

export const assetSchema = z.object({
  ticker: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(z.string().regex(TICKER_REGEX, "Ticker inválido")),
  name: z
    .string()
    .trim()
    .min(1)
    .max(LIMITS.assetName)
    .regex(NO_MARKUP, "Caracteres não permitidos"),
  type: z.enum(ASSET_TYPES),
  quantity: z.number().positive().max(MAX_ASSET_NUMBER),
  // O front aceita preço médio 0 (ex.: bonificação).
  avgPrice: z.number().nonnegative().max(MAX_ASSET_NUMBER),
  contributions: z.number().nonnegative().max(MAX_MONEY).default(0),
});

export function invalid(error: z.ZodError) {
  return {
    message: "Dados inválidos.",
    errors: error.flatten().fieldErrors,
  };
}
