import { TicketNotification } from '../models/ticket-notification.model';
import { glpiService } from './glpi.service';
import { evolutionService } from './evolution.service';
import { glpiConfig } from '../config/glpi';
import logger from '../utils/logger';

const STATUS_LABELS: Record<number, string> = {
  1: 'Novo',
  2: 'Em atendimento (atribuído)',
  3: 'Em atendimento (planejado)',
  4: 'Pendente',
  5: 'Solucionado',
  6: 'Fechado',
};

function isBusinessHours(): boolean {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: 'numeric',
    hour12: false,
  });
  const hour = parseInt(formatter.format(new Date()));
  return hour >= 8 && hour < 17;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

class TicketNotificationService {
  async track(phone: string, glpiTicketId: number, initialStatus: number): Promise<void> {
    await TicketNotification.create({ phone, glpiTicketId, lastFollowupId: null, lastStatus: initialStatus });
    logger.info(`[TicketNotification] Monitorando chamado #${glpiTicketId} para ${phone}`);
  }

  async checkUpdates(force = false): Promise<void> {
    if (!force && !isBusinessHours()) return;

    const tracked = await TicketNotification.findAll();
    if (tracked.length === 0) return;

    logger.info(`[TicketNotification] Verificando ${tracked.length} chamado(s)`);

    for (const record of tracked) {
      try {
        await this.processTicket(record);
      } catch (error) {
        logger.error(`[TicketNotification] Erro no chamado #${record.glpiTicketId}:`, error);
      }
    }
  }

  private async processTicket(record: TicketNotification): Promise<void> {
    const [ticket, followups] = await Promise.all([
      glpiService.getTicketStatus(record.glpiTicketId),
      glpiService.getTicketFollowups(record.glpiTicketId),
    ]);

    if (!ticket) return;

    // Notifica novos acompanhamentos
    const newFollowups = followups.filter(f => f.id > (record.lastFollowupId ?? 0));
    if (newFollowups.length > 0) {
      const lastFollowup = newFollowups[newFollowups.length - 1];
      const ticketUrl = await glpiService.getTicketUrl(record.glpiTicketId);

      const content = stripHtml(lastFollowup.content);

      await evolutionService.sendText(
        record.phone,
        [
          `📋 *Chamado #${record.glpiTicketId} possui uma nova interação!*`,
          ``,
          content,
          ``,
          `Para visualizar, acesse o portal:`,
          ticketUrl,
          ``,
          `_Não responda esta mensagem._`,
        ].join('\n')
      );

      await record.update({ lastFollowupId: lastFollowup.id });
    }

    // Notifica mudança de status
    if (ticket.status !== record.lastStatus) {
      const statusLabel = STATUS_LABELS[ticket.status] || `Status ${ticket.status}`;
      await evolutionService.sendText(
        record.phone,
        `🔔 *Chamado #${record.glpiTicketId}* — Status atualizado para: *${statusLabel}*`
      );
      await record.update({ lastStatus: ticket.status });

      if (ticket.status === 5 || ticket.status === 6) {
        await record.destroy();
        logger.info(`[TicketNotification] Chamado #${record.glpiTicketId} encerrado, removido do monitoramento.`);
      }
    }
  }
}

export const ticketNotificationService = new TicketNotificationService();
