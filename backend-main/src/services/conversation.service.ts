import { Session } from '../models/session.model';
import { ConversationState, ConversationSession, IncomingMessage } from '../types/conversation.types';
import { triagemService } from './triagem.service';
import { evolutionService } from './evolution.service';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

const SESSION_TIMEOUT_MINUTES = parseInt(process.env.SESSION_TIMEOUT_MINUTES || '30');

export class ConversationService {

  async handleIncomingMessage(message: IncomingMessage): Promise<void> {
    // Ignora mensagens enviadas pelo próprio bot
    if (message.phone.endsWith('@g.us')) {
      logger.info('[Conversation] Mensagem de grupo ignorada.');
      return;
    }

    let session = await this.getOrCreateSession(message.phone);

    // Sessão expirada ou finalizada → reseta para INITIAL via UPDATE (evita race condition de destroy+create)
    if (this.isExpiredOrDone(session)) {
      await Session.update(
        {
          state: ConversationState.INITIAL,
          attemptCount: 0,
          glpiUserId: null,
          glpiUserName: null,
          glpiUserEmail: null,
          ticketType: null,
          description: null,
          urgency: null,
          categoryId: null,
          categoryName: null,
          glpiTicketId: null,
          lastActivityAt: new Date(),
          expiresAt: this.calcExpiry(),
        },
        { where: { phone: message.phone } }
      );
      const updated = await Session.findOne({ where: { phone: message.phone } });
      session = updated!.toJSON() as unknown as ConversationSession;
    }

    try {
      await evolutionService.sendTyping(message.phone);

      const result = await triagemService.process(session, message.messageText);

      // Persiste atualizações na sessão
      await Session.update(
        {
          state: result.newState,
          lastActivityAt: new Date(),
          expiresAt: this.calcExpiry(),
          ...result.sessionUpdates,
        },
        { where: { phone: message.phone } }
      );

      // Envia todas as respostas sequencialmente
      for (const response of result.responses) {
        await evolutionService.sendText(response.to, response.message);
        // Pequena pausa entre mensagens para melhor UX
        if (result.responses.length > 1) {
          await new Promise((r) => setTimeout(r, 800));
        }
      }

      logger.info(
        `[Conversation] ${message.phone} | ${session.state} → ${result.newState}`
      );
    } catch (error) {
      logger.error('[Conversation] Erro no processamento:', error);
      await evolutionService.sendText(
        message.phone,
        '⚠️ Ocorreu um erro inesperado. Por favor, tente novamente em instantes.'
      );
    }
  }

  private async getOrCreateSession(phone: string): Promise<ConversationSession> {
    let record = await Session.findOne({ where: { phone } });

    if (!record) {
      record = await Session.create({
        id: uuidv4(),
        phone,
        state: ConversationState.INITIAL,
        attemptCount: 0,
        glpiUserId: null,
        glpiUserName: null,
        glpiUserEmail: null,
        ticketType: null,
        description: null,
        urgency: null,
        categoryId: null,
        categoryName: null,
        glpiTicketId: null,
        lastActivityAt: new Date(),
        expiresAt: this.calcExpiry(),
      });
      logger.info(`[Conversation] Nova sessão criada: ${phone}`);
    }

    return record.toJSON() as unknown as ConversationSession;
  }

  private isExpiredOrDone(session: ConversationSession): boolean {
    const finalStates = [
      ConversationState.COMPLETED,
      ConversationState.TRANSFERRED,
      ConversationState.CANCELLED,
    ];

    if (finalStates.includes(session.state)) return true;
    if (new Date() > new Date(session.expiresAt)) {
      logger.info(`[Conversation] Sessão expirada: ${session.phone}`);
      return true;
    }
    return false;
  }

  private calcExpiry(): Date {
    return new Date(Date.now() + SESSION_TIMEOUT_MINUTES * 60 * 1000);
  }

  // ─── Limpeza Periódica de Sessões Expiradas ──────────────────────────

  async cleanExpiredSessions(): Promise<void> {
    const deleted = await Session.destroy({
      where: {
        expiresAt: { $lt: new Date() } as never,
      },
    });
    if (deleted > 0) {
      logger.info(`[Conversation] ${deleted} sessões expiradas removidas.`);
    }
  }
}

export const conversationService = new ConversationService();
