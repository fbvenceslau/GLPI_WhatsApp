import { ConversationSession } from '../types/conversation.types';
import {
  GlpiTicketPayload,
  GlpiTicketType,
  GlpiUrgency,
  GlpiImpact,
  URGENCY_LABELS,
  TYPE_LABELS,
} from '../types/glpi.types';
import { glpiConfig } from '../config/glpi';

function deriveImpact(urgency: GlpiUrgency): GlpiImpact {
  const impactMap: Record<GlpiUrgency, GlpiImpact> = {
    [GlpiUrgency.VERY_LOW]: GlpiImpact.VERY_LOW,
    [GlpiUrgency.LOW]: GlpiImpact.LOW,
    [GlpiUrgency.MEDIUM]: GlpiImpact.MEDIUM,
    [GlpiUrgency.HIGH]: GlpiImpact.HIGH,
    [GlpiUrgency.VERY_HIGH]: GlpiImpact.VERY_HIGH,
  };
  return impactMap[urgency];
}

function buildTicketTitle(session: ConversationSession): string {
  const typeLabel = TYPE_LABELS[session.ticketType!];
  const category = session.categoryName || 'Geral';
  const maxLen = 60;
  const descSnippet = session.description!.slice(0, maxLen).replace(/\n/g, ' ');
  return `[${typeLabel}] ${category} - ${descSnippet}${session.description!.length > maxLen ? '...' : ''}`;
}

function buildTicketContent(session: ConversationSession): string {
  const lines = [
    `## Chamado aberto via WhatsApp`,
    ``,
    `**Solicitante:** ${session.glpiUserName} (${session.glpiUserEmail || 'sem e-mail'})`,
    session.entityName ? `**Entidade:** ${session.entityName}` : null,
    `**Tipo:** ${TYPE_LABELS[session.ticketType!]}`,
    `**Categoria:** ${session.categoryName}`,
    `**Urgência:** ${URGENCY_LABELS[session.urgency!]}`,
    ``,
    `### Relato do Usuário`,
    session.description,
    ``,
    `---`,
    `*Chamado criado automaticamente pelo Bot de Atendimento WhatsApp.*`,
    `*Data/Hora: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}*`,
  ].filter((l) => l !== null);
  return lines.join('\n');
}

export function buildGlpiPayload(session: ConversationSession): GlpiTicketPayload {
  if (!session.glpiUserId || !session.ticketType || !session.description || !session.urgency) {
    throw new Error('Sessão incompleta: campos obrigatórios ausentes para criar o chamado.');
  }

  return {
    input: {
      name: buildTicketTitle(session),
      content: buildTicketContent(session),
      type: session.ticketType,
      urgency: session.urgency,
      impact: deriveImpact(session.urgency),
      itilcategories_id: session.categoryId || 0,
      _users_id_requester: session.glpiUserId,
      users_id_recipient: session.glpiUserId,
      requesttypes_id: glpiConfig.requestTypeId,
      entities_id: session.entityId ?? glpiConfig.defaultEntityId,
    },
  };
}

export function buildConfirmationSummary(session: ConversationSession): string {
  const urgLabel = URGENCY_LABELS[session.urgency!];
  const typeLabel = TYPE_LABELS[session.ticketType!];
  const descPreview = session.description!.slice(0, 200);
  const truncated = session.description!.length > 200 ? '...' : '';

  const lines = [
    `📋 *Resumo do seu chamado:*`,
    ``,
    `👤 *Solicitante:* ${session.glpiUserName}`,
  ];

  if (session.entityName) lines.push(`🏢 *Entidade:* ${session.entityName}`);

  lines.push(
    `🔧 *Tipo:* ${typeLabel}`,
    `📁 *Categoria:* ${session.categoryName}`,
    `⚡ *Urgência:* ${urgLabel}`,
    ``,
    `📝 *Descrição:*`,
    `_${descPreview}${truncated}_`,
    ``,
    `Confirma a abertura do chamado?`,
    `*1* - ✅ Sim, abrir chamado`,
    `*2* - ✏️ Não, quero corrigir`,
    `*0* - ❌ Cancelar`,
  );

  return lines.join('\n');
}
