export function mapAsset(r: Record<string, unknown>) {
  return {
    id: r.id,
    ticker: r.ticker,
    name: r.name,
    type: r.type,
    quantity: parseFloat(r.quantity as string),
    avgPrice: parseFloat(r.avg_price as string),
    contributions: parseFloat((r.contributions as string) ?? "0"),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export const DUPLICATE_TICKER_MESSAGE =
  "Ativo já existe na carteira. Use edição para atualizar.";
