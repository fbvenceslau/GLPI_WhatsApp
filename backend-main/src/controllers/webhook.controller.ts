import { Request, Response } from 'express';
import { EvolutionWebhookPayload } from '../types/evolution.types';
import { IncomingMessage } from '../types/conversation.types';
import { conversationService } from '../services/conversation.service';
import { glpiService } from '../services/glpi.service';
import { Session } from '../models/session.model';
import { ConversationState } from '../types/conversation.types';
import { GlpiStatus } from '../types/glpi.types';
import logger from '../utils/logger';

// ─── Evolution API Webhook ─────────────────────────────────────────────────

export async function handleEvolutionWebhook(req: Request, res: Response): Promise<void> {
  // Responde imediatamente (Evolution API espera 200 rápido)
  res.status(200).json({ status: 'received' });

  const payload = req.body as EvolutionWebhookPayload;

  // Filtra apenas eventos de mensagem recebida (não enviadas pelo bot)
  if (payload.event !== 'messages.upsert') return;
  if (!payload.data || payload.data.key.fromMe) return;

  const messageText = extractMessageText(payload);
  if (!messageText) {
    logger.info('[Webhook/Evolution] Mensagem sem texto (mídia não suportada), ignorada.');
    return;
  }

  const phone = payload.data.key.remoteJid;
  const incoming: IncomingMessage = {
    instanceName: payload.instance,
    phone,
    pushName: payload.data.pushName || '',
    messageText,
    messageId: payload.data.key.id,
    timestamp: payload.data.messageTimestamp,
  };

  logger.info(`[Webhook/Evolution] Mensagem recebida de ${phone}: "${messageText.slice(0, 80)}"`);

  // Processa de forma assíncrona sem bloquear o response
  conversationService.handleIncomingMessage(incoming).catch((err) => {
    logger.error('[Webhook/Evolution] Erro ao processar mensagem:', err);
  });
}

function extractMessageText(payload: EvolutionWebhookPayload): string | null {
  const msg = payload.data?.message;
  if (!msg) return null;

  return (
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.documentMessage?.caption ||
    null
  );
}

// ─── WhaTicket Webhook ────────────────────────────────────────────────────
// Disparado quando um ticket é FECHADO no WhaTicket.
// Atualiza o status do chamado correspondente no GLPI.

export async function handleWhaTicketWebhook(req: Request, res: Response): Promise<void> {
  res.status(200).json({ status: 'received' });

  const { event, ticket } = req.body as {
    event: string;
    ticket: { id: number; status: string; contact: { number: string } };
  };

  if (event !== 'ticket.closed' && event !== 'ticket:status') return;
  if (ticket.status !== 'closed') return;

  const phone = ticket.contact?.number;
  if (!phone) return;

  logger.info(`[Webhook/WhaTicket] Ticket fechado para ${phone}`);

  try {
    // Busca a sessão com chamado GLPI associado
    const session = await Session.findOne({
      where: { phone: `${phone}@s.whatsapp.net` },
    });

    if (!session?.glpiTicketId) {
      logger.info(`[Webhook/WhaTicket] Nenhum chamado GLPI encontrado para ${phone}.`);
      return;
    }

    // Atualiza o chamado no GLPI para "Resolvido" quando o WhaTicket fecha
    // Isso garante rastreabilidade bidirecional
    await updateGlpiTicketStatus(session.glpiTicketId, GlpiStatus.SOLVED);

    // Marca a sessão como completa
    await session.update({ state: ConversationState.COMPLETED });

    logger.info(
      `[Webhook/WhaTicket] Chamado GLPI #${session.glpiTicketId} atualizado para Resolvido.`
    );
  } catch (error) {
    logger.error('[Webhook/WhaTicket] Erro ao atualizar GLPI:', error);
  }
}

async function updateGlpiTicketStatus(ticketId: number, status: GlpiStatus): Promise<void> {
  // glpiService expõe a sessão internamente — chamamos via método público em produção
  // Aqui usamos axios diretamente como integração do WhaTicket → GLPI
  const axios = (await import('axios')).default;
  const { glpiConfig } = await import('../config/glpi');

  // Inicia sessão GLPI
  const sessionRes = await axios.get(`${glpiConfig.baseUrl}/initSession`, {
    headers: {
      'App-Token': glpiConfig.appToken,
      Authorization: `user_token ${glpiConfig.userToken}`,
    },
  });
  const sessionToken = sessionRes.data.session_token;

  // Atualiza o ticket
  await axios.put(
    `${glpiConfig.baseUrl}/Ticket/${ticketId}`,
    { input: { status } },
    {
      headers: {
        'App-Token': glpiConfig.appToken,
        'Session-Token': sessionToken,
        'Content-Type': 'application/json',
      },
    }
  );

  // Encerra sessão
  await axios.get(`${glpiConfig.baseUrl}/killSession`, {
    headers: { 'App-Token': glpiConfig.appToken, 'Session-Token': sessionToken },
  });
}

// ─── Health Check ─────────────────────────────────────────────────────────

export async function healthCheck(_req: Request, res: Response): Promise<void> {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'chamados-backend',
  });
}
