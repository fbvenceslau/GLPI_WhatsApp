# Chamados WhatsApp + GLPI

Sistema de abertura de chamados de suporte técnico via WhatsApp, com triagem ITIL automatizada e integração nativa com a API REST do GLPI. Inclui transbordo para atendimento humano via WhaTicket.

---

## Sumário

- [Visão Geral](#visão-geral)
- [Stack Tecnológica](#stack-tecnológica)
- [Pré-requisitos](#pré-requisitos)
- [Instalação e Configuração](#instalação-e-configuração)
- [Fluxo Conversacional](#fluxo-conversacional)
- [Arquitetura](#arquitetura)
- [Endpoints](#endpoints)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Integração GLPI](#integração-glpi)
- [Integração Evolution API](#integração-evolution-api)
- [Integração WhaTicket](#integração-whaticket)
- [Painel Administrativo](#painel-administrativo)
- [Estrutura de Diretórios](#estrutura-de-diretórios)

---

## Visão Geral

O bot conduz o usuário por 6 etapas ITIL via WhatsApp:

1. **Identificação** — localiza o usuário no GLPI pelo e-mail corporativo
2. **Triagem** — diferencia Incidente (falha) de Requisição (pedido)
3. **Descrição** — coleta relato detalhado
4. **Urgência** — escala de 1 (Muito Baixa) a 5 (Muito Alta) para cálculo de SLA
5. **Categoria** — lista as categorias do GLPI filtradas pelo tipo do chamado
6. **Confirmação** — exibe resumo e cria o chamado via API

Após a criação, o usuário recebe o número do chamado e o link direto para acompanhamento no portal GLPI.

---

## Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Backend | Node.js 20 + Express + TypeScript |
| ORM | Sequelize 6 (PostgreSQL ou MySQL) |
| Painel Admin | AdminJS 7 |
| Frontend | Next.js 14 + React 18 + Bootstrap 5 |
| WhatsApp | Evolution API (container Docker) |
| Transbordo | WhaTicket Community (container Docker separado) |
| Infraestrutura | Docker + Docker Compose |
| ITSM | GLPI (REST API) |

---

## Pré-requisitos

- Docker Desktop (Windows) ou Docker Engine + Compose (Linux)
- Node.js 20+ e npm (para desenvolvimento local)
- Instância GLPI acessível via HTTP com REST API habilitada
- Número de WhatsApp dedicado ao suporte

---

## Instalação e Configuração

### 1. Clonar e configurar variáveis

```bash
cd D:\Projects\Chamados\backend-main
copy .env.example .env
# Edite o .env com suas credenciais (ver seção Variáveis de Ambiente)
```

### 2. Subir a infraestrutura

```bash
docker-compose up -d
# Inicia: PostgreSQL + Backend Node.js + Evolution API
```

### 3. Conectar o WhatsApp

Acesse o painel da Evolution API em `http://localhost:8080` e escaneie o QR Code com o WhatsApp do número de suporte.

### 4. Configurar o Webhook na Evolution API

No painel da Evolution API, configure:
- **Webhook URL**: `http://seu-servidor:3001/webhook/evolution`
- **Eventos**: `MESSAGES_UPSERT`, `CONNECTION_UPDATE`

### 5. Frontend (opcional)

```bash
cd D:\Projects\Chamados\frontend-main
copy .env.example .env.local
# Configure NEXT_PUBLIC_API_URL=http://localhost:3001
npm install && npm run dev
# Acesse: http://localhost:3000
```

---

## Fluxo Conversacional

```
Usuário envia mensagem
    │
    ▼
[INITIAL] → Envia boas-vindas e pede e-mail
    │
    ▼
[AWAITING_EMAIL] → Busca usuário no GLPI por e-mail
    │ encontrado
    ▼
[AWAITING_TYPE] → Menu: 1=Incidente / 2=Requisição
    │
    ▼
[AWAITING_DESCRIPTION] → Coleta relato livre (mín. 10 chars)
    │
    ▼
[AWAITING_URGENCY] → Menu: 1 a 5
    │
    ▼
[AWAITING_CATEGORY] → Lista categorias do GLPI filtradas por tipo
    │
    ▼
[AWAITING_CONFIRMATION] → Exibe resumo: 1=Confirmar / 2=Corrigir / 0=Cancelar
    │ confirma
    ▼
[COMPLETED] → Chamado criado no GLPI → Envia #ID e link

Interrupções a qualquer momento:
  "humano" | "atendente" | "ajuda" → [TRANSFERRED] (WhaTicket)
  3 tentativas inválidas seguidas → [TRANSFERRED] (WhaTicket)
  Sessão inativa por 30min → reinício automático na próxima mensagem
```

---

## Arquitetura

```
┌──────────────────────────────────────────────────────────────────────┐
│                         backend-main                                  │
│                                                                        │
│  POST /webhook/evolution ──▶ webhook.controller                        │
│                                      │                                 │
│                              conversation.service                      │
│                              (Session ↔ PostgreSQL)                    │
│                                      │                                 │
│                              triagem.service                           │
│                              (State Machine ITIL)                      │
│                                      │                                 │
│                    ┌─────────────────┴──────────────────┐             │
│                    │                                    │             │
│             glpi.service                    evolution.service          │
│             (REST GLPI)                     (envio WhatsApp)           │
│                    │                                    │             │
│             ┌──────┴──────┐                    Evolution API           │
│          Usuário GLPI  Chamado GLPI             (container)            │
│          (busca email) (POST /Ticket)                  │              │
│                                                        │              │
│  POST /webhook/whaticket ──▶ webhook.controller        │              │
│  (ticket fechado no WhaTicket)      │                  │              │
│                              Atualiza GLPI             ▼              │
│                              ticket → SOLVED      WhatsApp            │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Endpoints

### Públicos (requerem `x-webhook-secret`)

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/webhook/evolution` | Recebe mensagens da Evolution API |
| `POST` | `/webhook/whaticket` | Recebe eventos de fechamento do WhaTicket |
| `GET` | `/webhook/health` | Health check |

### Internos (requerem `x-api-key`)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/glpi/categories?type=1\|2` | Lista categorias do GLPI |
| `GET` | `/api/glpi/users?email=` | Busca usuário no GLPI por e-mail |

### Painel Admin

| Rota | Descrição |
|---|---|
| `/admin` | AdminJS — visualização e gestão de sessões ativas |

---

## Variáveis de Ambiente

Arquivo: `backend-main/.env` (copie de `.env.example`)

```env
# Servidor
PORT=3001
NODE_ENV=development

# Banco de Dados
DB_DIALECT=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=chamados_db
DB_USER=chamados_user
DB_PASSWORD=sua_senha

# GLPI
GLPI_BASE_URL=http://glpi.empresa.com/apirest.php
GLPI_APP_TOKEN=app_token_do_glpi
GLPI_USER_TOKEN=user_token_do_tecnico_api
GLPI_PORTAL_URL=http://glpi.empresa.com
GLPI_REQUEST_TYPE_ID=1        # ID da fonte de requisição (1=Helpdesk)
GLPI_ENTITY_ID=0              # Entidade padrão (0=raiz)

# Evolution API
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=chave_da_evolution
EVOLUTION_INSTANCE=suporte

# WhaTicket
WHATICKET_WEBHOOK_SECRET=secret_do_whaticket
WHATICKET_API_URL=http://localhost:3000

# Segurança
WEBHOOK_SECRET=secret_para_evolution_webhook
ADMIN_SECRET=api_key_para_endpoints_internos
ADMIN_EMAIL=admin@empresa.com
ADMIN_PASSWORD=senha_admin_painel
SESSION_SECRET=string_longa_aleatoria

# Sessão do Bot
SESSION_TIMEOUT_MINUTES=30
```

---

## Integração GLPI

### Configurar a REST API no GLPI

1. Acesse **Configuração → Geral → API**
2. Habilite a API REST
3. Crie um **Application Token** para esta integração
4. Crie um usuário técnico dedicado e gere seu **User Token** em **Preferências → Segurança**
5. Configure `GLPI_APP_TOKEN` e `GLPI_USER_TOKEN` no `.env`

### Fonte de Requisição "WhatsApp"

Para identificar os chamados como originados do WhatsApp no GLPI:

1. Acesse **Configuração → Listas suspensas → Origem das requisições**
2. Crie um item "WhatsApp"
3. Anote o ID gerado e configure em `GLPI_REQUEST_TYPE_ID`

### Payload criado no GLPI

```json
{
  "input": {
    "name": "[Incidente] Infraestrutura - Servidor sem acesso...",
    "content": "## Chamado aberto via WhatsApp\n**Solicitante:** João Silva...",
    "type": 1,
    "urgency": 4,
    "impact": 4,
    "itilcategories_id": 12,
    "_users_id_requester": 5,
    "users_id_recipient": 5,
    "requesttypes_id": 6,
    "entities_id": 0
  }
}
```

---

## Integração Evolution API

A Evolution API deve estar configurada com webhook global apontando para o backend:

```
WEBHOOK_GLOBAL_URL=http://backend:3001/webhook/evolution
WEBHOOK_EVENTS_MESSAGES_UPSERT=true
WEBHOOK_EVENTS_CONNECTION_UPDATE=true
```

O backend só processa mensagens com `event = messages.upsert` e `fromMe = false`. Mensagens de grupos (`@g.us`) são descartadas automaticamente.

---

## Integração WhaTicket

O WhaTicket é usado para transbordo humano quando:
- O usuário digita "humano", "atendente" ou "ajuda"
- O bot atinge 3 tentativas inválidas consecutivas

Para sincronizar o fechamento de tickets de volta ao GLPI, adicione no código do WhaTicket (`services/wbotMessageListener.ts`):

```typescript
import axios from 'axios';

// Quando um ticket for fechado no WhaTicket:
if (ticket.status === 'closed') {
  await axios.post(
    `${process.env.CHAMADOS_BACKEND_URL}/webhook/whaticket`,
    {
      event: 'ticket.closed',
      ticket: {
        id: ticket.id,
        status: 'closed',
        contact: { number: ticket.contact.number }
      }
    },
    {
      headers: {
        'x-whaticket-secret': process.env.WHATICKET_WEBHOOK_SECRET
      }
    }
  );
}
```

Adicione ao `.env` do WhaTicket:
```env
CHAMADOS_BACKEND_URL=http://backend:3001
WHATICKET_WEBHOOK_SECRET=mesmo_valor_do_backend
```

---

## Painel Administrativo

Acesse `http://localhost:3001/admin` com as credenciais `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

Funcionalidades disponíveis:
- Visualizar todas as sessões de conversação ativas
- Filtrar por estado (`AWAITING_EMAIL`, `COMPLETED`, etc.) ou número de telefone
- Deletar sessões manualmente (útil para resetar um atendimento travado)

---

## Estrutura de Diretórios

```
D:\Projects\Chamados\
├── CLAUDE.md                          ← Guia para Claude Code
├── README.md                          ← Esta documentação
│
├── backend-main/
│   ├── admin/adminjs.config.ts        ← Painel AdminJS
│   ├── src/
│   │   ├── app.ts                     ← Entry point Express
│   │   ├── config/                    ← database, glpi, evolution
│   │   ├── controllers/
│   │   │   ├── webhook.controller.ts  ← Entry dos webhooks (Evolution + WhaTicket)
│   │   │   └── glpi.controller.ts     ← Consultas GLPI (categorias, usuários)
│   │   ├── services/
│   │   │   ├── triagem.service.ts     ← State machine ITIL (núcleo do bot)
│   │   │   ├── conversation.service.ts← Orquestra sessões e respostas
│   │   │   ├── glpi.service.ts        ← Client REST GLPI
│   │   │   └── evolution.service.ts   ← Envio de mensagens WhatsApp
│   │   ├── models/session.model.ts    ← Sessão de conversação (Sequelize)
│   │   ├── routes/                    ← webhook.routes, admin.routes
│   │   ├── middlewares/auth.middleware.ts
│   │   ├── types/                     ← glpi.types, conversation.types, evolution.types
│   │   └── utils/
│   │       ├── payload.builder.ts     ← Monta GlpiTicketPayload + confirmação
│   │       └── logger.ts              ← Winston
│   ├── docker-compose.yml
│   ├── Dockerfile
│   └── .env.example
│
└── frontend-main/
    ├── src/
    │   ├── app/                       ← layout, dashboard, tickets (Next.js App Router)
    │   ├── components/                ← TicketCard, StatusBadge
    │   ├── services/api.ts            ← Axios client
    │   └── types/ticket.types.ts      ← Labels e interfaces de chamados
    └── next.config.js
```

---

## Licença

Projeto proprietário — uso interno corporativo.
#   G L P I _ W h a t s A p p  
 