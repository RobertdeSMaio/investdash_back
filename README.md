# InvestDash — Backend

Next.js API Routes + Neon PostgreSQL

## Setup

```bash
npm install
cp .env.example .env   # preencha as variáveis
npm run dev
```

## Variáveis de ambiente

Veja `.env.example`. Em produção, cadastre-as no projeto da Vercel.

| Variável | Uso |
|----------|-----|
| `DATABASE_URL` | Conexão Neon |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Assinatura dos tokens (valores longos e distintos) |
| `SMTP_*` | Envio de e-mails (confirmação e reset de senha) |
| `BRAPI_TOKEN` | Token da brapi.dev para cotações (sem ele, só tickers de teste) |
| `APP_URL` | URL do frontend usada nos links enviados por e-mail |
| `ALLOWED_ORIGIN` | Origem liberada no CORS (lida no build — redeploy ao alterar) |

## Deploy

1. Rode as migrações pendentes de `migrations/` no Neon (são idempotentes).
2. Confira as variáveis de ambiente na Vercel.
3. Faça o deploy.

## Autenticação

- `accessToken` (15 min) vai no header `Authorization: Bearer …`; o front o mantém só em memória.
- `refreshToken` (7 dias) é rotacionado a cada `/api/auth/refresh`. Reusar um token já rotacionado revoga todas as sessões do usuário.
- O front chama `/api/auth/refresh` a cada recarga de página para obter um novo access token.
- Trocar ou redefinir a senha revoga todas as sessões.

## Rotas disponíveis

### Auth
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | /api/auth/register | Cadastro |
| POST | /api/auth/login | Login |
| POST | /api/auth/logout | Logout (revoga o refresh token) |
| POST | /api/auth/refresh | Renovar tokens |
| GET | /api/auth/confirm-email?token=&email= | Confirmar e-mail |
| POST | /api/auth/resend-confirmation | Reenviar confirmação (autenticado) |
| POST | /api/auth/forgot-password | Solicitar reset |
| POST | /api/auth/reset-password | Resetar senha |

Senhas novas: 8+ caracteres (máx. 72 bytes, limite do bcrypt), com minúscula, maiúscula, número e caractere especial — as mesmas regras do front (`src/utils/validationSchemas.ts`).

### Carteira (Portfolio)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /api/portfolio | Listar ativos |
| POST | /api/portfolio | Adicionar ativo |
| PUT | /api/portfolio/:id | Editar ativo (inclusive ticker e tipo) |
| DELETE | /api/portfolio/:id | Remover ativo |

Tipos aceitos: `acao`, `fii`, `etf`, `stock`, `renda_fixa`. Ticker duplicado na carteira retorna `409`.

O histórico diário do patrimônio e o perfil de investidor ficam no navegador. O câmbio e o CDI (Banco Central) são buscados direto pelo front.

### Cotações (proxy brapi.dev)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /api/market/quote?ticker=PETR4 | Cotação atual (cache 60s) |
| GET | /api/market/quote?ticker=PETR4&range=1mo | Histórico diário — `1mo`, `3mo`, `6mo`, `1y` (cache 10 min) |

Autenticada, com limite de 600 consultas/hora por usuário. O `BRAPI_TOKEN` fica só no servidor.

### Simulações
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /api/simulations | Listar simulações |
| POST | /api/simulations | Criar simulação |
| DELETE | /api/simulations/:id | Remover simulação |

Campos: `periodUnit` (mensal/anual), `contribution`, `contributionFrequency` (mensal/anual). O front atual não salva simulações; as rotas foram mantidas para preservar os dados existentes.

### Perfil
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /api/profile | Ver perfil |
| PUT | /api/profile | Atualizar nome |
| PUT | /api/profile/change-password | Trocar senha |

### Health
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /api/health | Status |

## Banco de dados

Banco novo: execute `schema.sql`. Banco existente: execute os arquivos de `migrations/` em ordem.
