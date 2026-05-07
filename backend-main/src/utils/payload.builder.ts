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

/**
 * Calcula o impacto baseado na urgência informada pelo usuário.
 * Regra ITIL: Prioridade = f(Urgência, Impacto).
 * Para chamados via WhatsApp, assumimos impacto = urgência como baseline.
 */
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

/**
 * Constrói o título do chamado automaticamente com base no tipo e categoria,
 * evitando títulos genéricos.
 */
function buildTicketTitle(session: ConversationSession): string {
  const typeLabel = TYPE_LABELS[session.ticketType!];
  const category = session.categoryName || 'Geral';
  const maxLen = 60;
  const descSnippet = session.description!.slice(0, maxLen).replace(/\n/g, ' ');
  return `[${typeLabel}] ${category} - ${descSnippet}${session.description!.length > maxLen ? '...' : ''}`;
}

/**
 * Formata o conteúdo completo do chamado no padrão ITIL para exibição no GLPI.
 */
function buildTicketContent(session: ConversationSession): string {
  const lines = [
    `## Chamado aberto via WhatsApp`,
    ``,
    `**Solicitante:** ${session.glpiUserName} (${session.glpiUserEmail})`,
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
  ];
  return lines.join('\n');
}

/**
 * Monta o payload final estruturado para a API REST do GLPI.
 * Requer que todos os campos obrigatórios estejam preenchidos na sessão.
 */
export function buildGlpiPayload(session: ConversationSession): GlpiTicketPayload {
  if (
    !session.glpiUserId ||
    !session.ticketType ||
    !session.description ||
    !session.urgency
  ) {
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
      entities_id: glpiConfig.defaultEntityId,
    },
  };
}

/**
 * Gera o resumo legível do chamado para confirmação pelo usuário via WhatsApp.
 */
export function buildConfirmationSummary(session: ConversationSession): string {
  const urgLabel = URGENCY_LABELS[session.urgency!];
  const typeLabel = TYPE_LABELS[session.ticketType!];
  const descPreview = session.description!.slice(0, 200);
  const truncated = session.description!.length > 200 ? '...' : '';

  return [
    `📋 *Resumo do seu chamado:*`,
    ``,
    `👤 *Solicitante:* ${session.glpiUserName}`,
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
  ].join('\n');
}
