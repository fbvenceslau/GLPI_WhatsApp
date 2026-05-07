# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Visão Geral

Sistema de abertura de chamados via WhatsApp integrado ao GLPI. O backend conduz o usuário por uma triagem ITIL conversacional (identificação → tipo → descrição → urgência → categoria → confirmação) e cria o chamado via GLPI REST API. O frontend é um painel de monitoramento em Next.js.

---

## Comandos

### Backend (`backend-main/`)

```bash
# Desenvolvimento (hot reload)
npm run dev

# Build para produção
npm run build && npm start

# Subir toda a infraestrutura (Postgres + Backend + Evolution API)
docker-compose up -d

# Subir apenas o banco de dados
docker-compose up -d postgres

# Verificar logs do backend em produção
docker-compose logs -f backend
```

### Frontend (`frontend-main/`)

```bash
npm run dev      # porta 3000
npm run build
npm start
```

### Primeira execução

```bash
# 1. Copiar e preencher variáveis de ambiente
cp backend-main/.env.example backend-main/.env

# 2. Campos obrigatórios no .env:
#    GLPI_BASE_URL, GLPI_APP_TOKEN, GLPI_USER_TOKEN
#    EVOLUTION_API_KEY, EVOLUTION_INSTANCE
#    DB_PASSWORD, WEBHOOK_SECRET

# 3. Gerar package-lock.json (necessário para npm ci no Docker)
cd backend-main && npm install

# 4. O banco é sincronizado automaticamente no bootstrap (Sequelize sync)
#    Não há script de migrate separado — o model Session é criado via alter:true em dev
```

### Se precisar recriar o banco (schema quebrado em dev)

```bash
docker-compose exec postgres psql -U chamados_user -d chamados_db \
  -c "DROP TABLE IF EXISTS conversation_sessions CASCADE; \
      DROP TYPE IF EXISTS enum_conversation_sessions_state CASCADE;"
docker-compose restart backend
```

---

## Arquitetura

### Fluxo principal de uma mensagem

```
WhatsApp → Evolution API → POST /webhook/evolution
                                    │
                          webhook.controller.ts
                          (responde 200 imediatamente,
                           processa de forma assíncrona)
                                    │
                          conversation.service.ts
                          (busca/cria Session no Postgres,
                           detecta sessão expirada/finalizada
                           e reinicia automaticamente)
                                    │
                          triagem.service.ts
                          (state machine ITIL — switch no session.state)
                                    │
                    ┌───────────────┴──────────────────┐
                    │                                  │
             glpi.service.ts                 evolution.service.ts
             (GLPI REST API)                 (envia resposta ao WhatsApp)
```

### State Machine (`ConversationState`)

Cada mensagem do usuário avança um estado. A sessão é persistida na tabela `conversation_sessions` após cada transição.

```
INITIAL → AWAITING_EMAIL → AWAITING_TYPE → AWAITING_DESCRIPTION
       → AWAITING_URGENCY → AWAITING_CATEGORY → AWAITING_CONFIRMATION
       → COMPLETED | TRANSFERRED | CANCELLED
```

- Estados finais (COMPLETED, TRANSFERRED, CANCELLED) fazem a sessão ser destruída e recriada na próxima mensagem do mesmo número.
- Qualquer mensagem com as palavras `humano`, `atendente`, `ajuda`, `help` desvia imediatamente para `TRANSFERRED`, independente do estado atual.
- Após 3 tentativas inválidas consecutivas em qualquer estado, o fluxo deriva automaticamente para `TRANSFERRED`.

### Integração GLPI

`glpi.service.ts` é um singleton que mantém um `session_token` em memória por 55 minutos (a sessão GLPI dura 1h). Toda chamada usa `getAuthHeaders()` que renova o token automaticamente se expirado.

A busca de usuário usa `GET /search/User` com `forcedisplay` para mapear os campos numéricos da API de busca para o objeto `GlpiUser`. Os índices dos campos são: `1`=ID, `2`=name, `5`=email, `8`=firstname, `9`=phone, `34`=realname.

A criação do chamado em `buildGlpiPayload()` usa `impacto = urgência` como baseline ITIL — ajuste a lógica em `deriveImpact()` se a empresa tiver matriz de prioridade personalizada.

### Armadilha: categorias serializadas no campo `description`

Durante o estado `AWAITING_CATEGORY`, a lista de categorias retornada do GLPI é serializada como JSON no campo `description` da sessão:

```json
{ "_categories": [...], "_desc": "texto original do usuário" }
```

O handler `handleCategory()` faz parse desse JSON para reconstruir as opções. Quando a categoria é selecionada, `description` é restaurado ao texto original. **Em produção com múltiplos processos, substitua por Redis.**

### Integração WhaTicket (transbordo bidirecional)

`POST /webhook/whaticket` recebe o evento `ticket.closed` do WhaTicket. Quando acionado:
1. Busca a `Session` pelo número de telefone no formato `{number}@s.whatsapp.net`
2. Se há `glpiTicketId`, atualiza o chamado GLPI para status `SOLVED` (5)
3. O `updateGlpiTicketStatus()` abre uma sessão GLPI própria via axios inline (não usa `glpiService`) para evitar colisão de tokens.

Para configurar o WhaTicket, adicione no `services/wbotMessageListener.ts` do WhaTicket:

```typescript
// Quando ticket for fechado:
await axios.post(`${process.env.CHAMADOS_BACKEND_URL}/webhook/whaticket`, {
  event: 'ticket.closed',
  ticket: { id: ticket.id, status: 'closed', contact: { number: ticket.contact.number } }
}, { headers: { 'x-whaticket-secret': process.env.WHATICKET_WEBHOOK_SECRET } });
```

### Autenticação e segurança

- `POST /webhook/evolution` → valida `x-webhook-secret` (ou `?secret=`) via `validateWebhookSecret`
- `POST /webhook/whaticket` → valida `x-whaticket-secret` via `validateWhaTicketSecret`
- `GET|POST /api/*` → valida `x-api-key` via `requireApiKey`
- `/admin` → autenticação de formulário pelo AdminJS (email/senha via `ADMIN_EMAIL`/`ADMIN_PASSWORD`)
- Se `WEBHOOK_SECRET` não estiver definido no `.env`, a validação é **desabilitada** em dev sem erro.

### Painel AdminJS

Montado em `/admin` apenas após `syncDatabase()` completar. Permite visualizar e deletar sessões ativas (`conversation_sessions`). Acesso via `ADMIN_EMAIL` / `ADMIN_PASSWORD` do `.env`.

---

## Variáveis de Ambiente Críticas

| Variável | Obrigatória | Descrição |
|---|---|---|
| `GLPI_BASE_URL` | Sim | Ex: `http://glpi.empresa.com/apirest.php` |
| `GLPI_APP_TOKEN` | Sim | Token da aplicação no GLPI |
| `GLPI_USER_TOKEN` | Sim | Token de usuário técnico (API) no GLPI |
| `GLPI_REQUEST_TYPE_ID` | Não | ID da fonte "WhatsApp" no GLPI (default: `1` = Helpdesk) |
| `EVOLUTION_API_KEY` | Sim | Chave da Evolution API |
| `EVOLUTION_INSTANCE` | Sim | Nome da instância WhatsApp na Evolution API |
| `WEBHOOK_SECRET` | Não | Se ausente, validação desabilitada em dev |
| `SESSION_TIMEOUT_MINUTES` | Não | Default: `30` minutos |

---

## Decisões de Projeto Relevantes

- **`phone` armazenado como JID completo**: o campo `Session.phone` usa o formato `5511999999999@s.whatsapp.net`. O `evolutionService.sendText()` remove o sufixo antes de enviar. Nunca compare apenas o número — use sempre o JID completo como chave.

- **Webhook responde 200 antes de processar**: a Evolution API tem timeout curto. O controller envia `res.json()` antes de chamar `conversationService.handleIncomingMessage()`, que roda assincronamente. Erros de processamento não chegam ao caller.

- **`Session.destroy()` antes de recriar**: sessões finalizadas são deletadas e recriadas do zero (não atualizadas), garantindo estado limpo sem campos residuais da conversa anterior.

- **AdminJS carregado pós-sync**: o router do AdminJS é registrado dentro da função `bootstrap()`, depois que `syncDatabase()` resolve. Registrá-lo antes causaria erro de modelo não inicializado.

- **Versões AdminJS fixadas em CJS-compatíveis**: `adminjs@6.8.7`, `@adminjs/express@5.1.0`, `@adminjs/sequelize@3.0.0`. As versões v7+/v6+/v4+ são ESM-only e incompatíveis com `module: commonjs`. Não faça upgrade sem migrar o projeto para ESM.

- **`@adminjs/sequelize@3.x` exporta `{ Resource, Database }` diretamente** (não dentro de um objeto `AdminJSSequelize`). O import correto é `import { Resource, Database } from '@adminjs/sequelize'`.

- **`unique: true` inline no Sequelize + `alter:true` gera SQL inválido no Postgres**: a unicidade da coluna `phone` é garantida pelo índice em `indexes: [{ fields: ['phone'], unique: true }]`. Nunca use `unique: true` diretamente na definição de coluna junto com `alter:true`.

- **`package-lock.json` é obrigatório para o build Docker** (`npm ci` exige lockfile). Sempre rode `npm install` localmente antes do primeiro `docker-compose up --build`.

- **Evolution API v2 (Prisma) — variáveis obrigatórias descobertas em produção**:
  - Usa `DATABASE_CONNECTION_URI` (não `DATABASE_URL`) — lido pelo schema Prisma em `/evolution/prisma/postgresql-schema.prisma`
  - `DATABASE_ENABLED: "false"` não funciona em v2.x — o Prisma sempre roda migrations. Banco real obrigatório.
  - O `runWithProvider.js` faz `dotenv.config()` que carrega o `.env` interno da imagem, mas variáveis do Docker Compose têm precedência (dotenv não sobrescreve env existente)
  - A Evolution API precisa de banco dedicado (`evolution`/`evolution_pass`) separado do banco do backend (`chamados_db`). Crie com: `docker-compose exec postgres psql -U chamados_user -d postgres -c "CREATE ROLE evolution WITH LOGIN PASSWORD 'evolution_pass'; CREATE DATABASE evolution OWNER evolution;"`
  - O webhook para o backend deve usar o **nome do container** (`chamados_backend`), não `localhost`: `WEBHOOK_GLOBAL_URL: "http://chamados_backend:3001/webhook/evolution"`
