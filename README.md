# InvestDash — Backend

Next.js API Routes + Neon PostgreSQL

## Setup

```bash
npm install
cp .env.example .env   # preencha as variáveis
npm run dev
```

## Variáveis de ambiente (.env)

```
DATABASE_URL=postgresql://...
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=resend
SMTP_PASS=re_...
APP_URL=https://seudominio.com
SMTP_FROM="InvestDash" <onboarding@resend.dev>
ALLOWED_ORIGIN=https://seudominio.com
```

## Rotas disponíveis

### Auth
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | /api/auth/register | Cadastro |
| POST | /api/auth/login | Login |
| POST | /api/auth/logout | Logout |
| POST | /api/auth/refresh | Renovar token |
| POST | /api/auth/confirm-email | Confirmar e-mail |
| POST | /api/auth/forgot-password | Solicitar reset |
| POST | /api/auth/reset-password | Resetar senha |

### Carteira (Portfolio)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /api/portfolio | Listar ativos |
| POST | /api/portfolio | Adicionar ativo |
| PUT | /api/portfolio/:id | Editar ativo |
| DELETE | /api/portfolio/:id | Remover ativo |

Tipos aceitos: `acao`, `fii`, `etf`, `stock`, `renda_fixa`

### Simulações
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /api/simulations | Listar simulações |
| POST | /api/simulations | Criar simulação |
| DELETE | /api/simulations/:id | Remover simulação |

Campos: `periodUnit` (mensal/anual), `contribution`, `contributionFrequency` (mensal/anual)

### Perfil
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /api/profile | Ver perfil |
| PUT | /api/profile | Atualizar nome |
| PUT | /api/profile/change-password | Trocar senha |

## Banco de dados

Execute o arquivo `schema.sql` no seu banco Neon para criar as tabelas.
