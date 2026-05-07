import { ConversationState, ConversationSession, TriagemResult } from '../types/conversation.types';
import { GlpiTicketType, GlpiUrgency, GlpiCategory, URGENCY_LABELS } from '../types/glpi.types';
import { glpiService } from './glpi.service';
import { buildConfirmationSummary, buildGlpiPayload } from '../utils/payload.builder';
import logger from '../utils/logger';

const MAX_ATTEMPTS = 3;

// ─── Mensagens do Bot ──────────────────────────────────────────────────────

const MSG = {
  WELCOME: `👋 Olá! Seja bem-vindo(a) ao *Suporte Técnico*.\n\nPara abrir um chamado, preciso identificar você em nosso sistema.\n\n📧 Por favor, informe seu *e-mail corporativo*:`,

  USER_FOUND: (name: string) =>
    `✅ Olá, *${name}*! Encontrei seu cadastro.\n\nComo posso ajudar hoje?\n\n*1* - 🔴 Incidente _(algo parou de funcionar)_\n*2* - 🔵 Requisição _(pedido de novo recurso ou serviço)_`,

  USER_NOT_FOUND: (email: string) =>
    `❌ Não encontrei nenhum usuário com o e-mail *${email}* em nosso sistema.\n\nVerifique se digitou corretamente e tente novamente, ou digite *HUMANO* para falar com um atendente.`,

  INVALID_EMAIL: `Por favor, informe um endereço de e-mail válido (ex: nome@empresa.com.br).`,

  ASK_DESCRIPTION_INCIDENT: `🔴 *Incidente registrado.*\n\nDescreva o problema com o máximo de detalhes:\n• O que parou de funcionar?\n• Desde quando?\n• Quantas pessoas/sistemas estão afetados?\n• Você recebeu alguma mensagem de erro?`,

  ASK_DESCRIPTION_REQUEST: `🔵 *Requisição registrada.*\n\nDescreva o que você precisa com detalhes:\n• O que está solicitando?\n• Qual a finalidade?\n• Há alguma data limite?`,

  ASK_URGENCY: `⚡ Qual é a urgência?\n\n*1* - Muito Baixa _(pode aguardar)_\n*2* - Baixa\n*3* - Média _(padrão)_\n*4* - Alta _(impacto significativo)_\n*5* - Muito Alta _(ambiente parado)_`,

  INVALID_OPTION: (max: number) =>
    `⚠️ Opção inválida. Por favor, escolha entre *1* e *${max}*.`,

  MAX_ATTEMPTS: `❌ Número máximo de tentativas atingido. Transferindo para um atendente humano...`,

  TICKET_CREATED: (id: number, url: string) =>
    `🎉 *Chamado #${id} aberto com sucesso!*\n\nNossa equipe de suporte foi notificada e entrará em contato conforme o SLA.\n\n🔗 Acompanhe pelo portal:\n${url}\n\n_Obrigado por contatar o Suporte Técnico!_`,

  CANCELLED: `❌ Chamado cancelado. Caso precise de ajuda, é só enviar uma nova mensagem!`,

  ERROR_CREATING: `⚠️ Ocorreu um erro ao criar o chamado. Por favor, aguarde — um atendente irá ajudá-lo(a).`,

  TRANSFER: `🔄 Transferindo seu atendimento para um agente humano. Por favor, aguarde...`,
};

// ─── Helpers ──────────────────────────────────────────────────────────────

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function parseMenuOption(text: string, max: number): number | null {
  const n = parseInt(text.trim());
  if (!isNaN(n) && n >= 1 && n <= max) return n;
  return null;
}

function formatCategoryMenu(categories: GlpiCategory[]): string {
  const lines = ['📁 Selecione a categoria do chamado:\n'];
  categories.forEach((cat, i) => {
    lines.push(`*${i + 1}* - ${cat.completename || cat.name}`);
  });
  lines.push('\n_Digite o número correspondente._');
  return lines.join('\n');
}

// ─── Serviço de Triagem ITIL ──────────────────────────────────────────────

export class TriagemService {

  async process(
    session: ConversationSession,
    userMessage: string
  ): Promise<TriagemResult> {
    const text = userMessage.trim();

    // Palavra-chave global: transbordo para humano
    if (['humano', 'atendente', 'pessoa', 'ajuda', 'help'].includes(text.toLowerCase())) {
      return this.transfer(session);
    }

    switch (session.state) {
      case ConversationState.INITIAL:
        return this.handleInitial(session);

      case ConversationState.AWAITING_EMAIL:
        return this.handleEmail(session, text);

      case ConversationState.AWAITING_TYPE:
        return this.handleType(session, text);

      case ConversationState.AWAITING_DESCRIPTION:
        return this.handleDescription(session, text);

      case ConversationState.AWAITING_URGENCY:
        return this.handleUrgency(session, text);

      case ConversationState.AWAITING_CATEGORY:
        return this.handleCategory(session, text);

      case ConversationState.AWAITING_CONFIRMATION:
        return this.handleConfirmation(session, text);

      default:
        return this.handleInitial(session);
    }
  }

  // ─── Handlers por Estado ──────────────────────────────────────────────

  private handleInitial(session: ConversationSession): TriagemResult {
    return {
      responses: [{ to: session.phone, message: MSG.WELCOME }],
      newState: ConversationState.AWAITING_EMAIL,
      sessionUpdates: { attemptCount: 0 },
    };
  }

  private async handleEmail(
    session: ConversationSession,
    text: string
  ): Promise<TriagemResult> {
    if (!isValidEmail(text)) {
      return this.invalidInput(session, MSG.INVALID_EMAIL, ConversationState.AWAITING_EMAIL);
    }

    const email = text.toLowerCase().trim();
    logger.info(`[Triagem] Buscando usuário no GLPI: ${email}`);

    const user = await glpiService.findUserByEmail(email);

    if (!user) {
      const attempts = (session.attemptCount || 0) + 1;
      if (attempts >= MAX_ATTEMPTS) return this.transfer(session);

      return {
        responses: [{ to: session.phone, message: MSG.USER_NOT_FOUND(email) }],
        newState: ConversationState.AWAITING_EMAIL,
        sessionUpdates: { attemptCount: attempts },
      };
    }

    const displayName = user.firstname
      ? `${user.firstname} ${user.realname}`.trim()
      : user.name;

    return {
      responses: [{ to: session.phone, message: MSG.USER_FOUND(displayName) }],
      newState: ConversationState.AWAITING_TYPE,
      sessionUpdates: {
        glpiUserId: user.id,
        glpiUserName: displayName,
        glpiUserEmail: user.email,
        attemptCount: 0,
      },
    };
  }

  private handleType(
    session: ConversationSession,
    text: string
  ): TriagemResult {
    const option = parseMenuOption(text, 2);

    if (!option) {
      return this.invalidInput(session, MSG.INVALID_OPTION(2), ConversationState.AWAITING_TYPE);
    }

    const ticketType = option === 1 ? GlpiTicketType.INCIDENT : GlpiTicketType.REQUEST;
    const askDesc =
      ticketType === GlpiTicketType.INCIDENT
        ? MSG.ASK_DESCRIPTION_INCIDENT
        : MSG.ASK_DESCRIPTION_REQUEST;

    return {
      responses: [{ to: session.phone, message: askDesc }],
      newState: ConversationState.AWAITING_DESCRIPTION,
      sessionUpdates: { ticketType, attemptCount: 0 },
    };
  }

  private handleDescription(
    session: ConversationSession,
    text: string
  ): TriagemResult {
    if (text.length < 10) {
      return {
        responses: [
          {
            to: session.phone,
            message: `⚠️ Descrição muito curta. Por favor, forneça mais detalhes sobre o problema (mínimo 10 caracteres).`,
          },
        ],
        newState: ConversationState.AWAITING_DESCRIPTION,
        sessionUpdates: {},
      };
    }

    return {
      responses: [{ to: session.phone, message: MSG.ASK_URGENCY }],
      newState: ConversationState.AWAITING_URGENCY,
      sessionUpdates: { description: text, attemptCount: 0 },
    };
  }

  private async handleUrgency(
    session: ConversationSession,
    text: string
  ): Promise<TriagemResult> {
    const option = parseMenuOption(text, 5);

    if (!option) {
      return this.invalidInput(session, MSG.INVALID_OPTION(5), ConversationState.AWAITING_URGENCY);
    }

    const urgency = option as GlpiUrgency;
    const categories = await glpiService.getCategories(session.ticketType);

    if (categories.length === 0) {
      // Fallback: sem categorias disponíveis, vai para confirmação com categoria padrão
      logger.warn('[Triagem] Nenhuma categoria encontrada no GLPI, usando padrão.');
      const updatedSession = { ...session, urgency, categoryId: 0, categoryName: 'Não categorizado' };
      const summary = buildConfirmationSummary(updatedSession as ConversationSession);
      return {
        responses: [{ to: session.phone, message: summary }],
        newState: ConversationState.AWAITING_CONFIRMATION,
        sessionUpdates: { urgency, categoryId: 0, categoryName: 'Não categorizado' },
      };
    }

    // Armazena a lista de categorias na sessão via contexto (em produção, use cache Redis)
    // Aqui serializamos no campo temporário via JSON
    const menuMessage = formatCategoryMenu(categories);

    return {
      responses: [{ to: session.phone, message: menuMessage }],
      newState: ConversationState.AWAITING_CATEGORY,
      sessionUpdates: {
        urgency,
        attemptCount: 0,
        // Armazena categorias serializadas no campo description temporariamente
        // Em produção: use Redis/cache separado
        description: JSON.stringify({ _categories: categories, _desc: session.description }),
      },
    };
  }

  private handleCategory(
    session: ConversationSession,
    text: string
  ): TriagemResult {
    // Recupera categorias do campo temporário
    let categories: GlpiCategory[] = [];
    let originalDescription = session.description || '';

    try {
      const parsed = JSON.parse(session.description || '{}');
      if (parsed._categories) {
        categories = parsed._categories;
        originalDescription = parsed._desc || '';
      }
    } catch {
      // description era texto puro (fallback)
    }

    const option = parseMenuOption(text, categories.length || 1);

    if (!option || !categories[option - 1]) {
      return this.invalidInput(
        session,
        MSG.INVALID_OPTION(categories.length),
        ConversationState.AWAITING_CATEGORY
      );
    }

    const selectedCategory = categories[option - 1];
    const updatedSession: ConversationSession = {
      ...session,
      description: originalDescription,
      categoryId: selectedCategory.id,
      categoryName: selectedCategory.completename || selectedCategory.name,
    };

    const summary = buildConfirmationSummary(updatedSession);

    return {
      responses: [{ to: session.phone, message: summary }],
      newState: ConversationState.AWAITING_CONFIRMATION,
      sessionUpdates: {
        description: originalDescription,
        categoryId: selectedCategory.id,
        categoryName: selectedCategory.completename || selectedCategory.name,
        attemptCount: 0,
      },
    };
  }

  private async handleConfirmation(
    session: ConversationSession,
    text: string
  ): Promise<TriagemResult> {
    const option = text.trim();

    if (option === '0') {
      return {
        responses: [{ to: session.phone, message: MSG.CANCELLED }],
        newState: ConversationState.CANCELLED,
        sessionUpdates: {},
      };
    }

    if (option === '2') {
      // Reinicia a coleta de dados mantendo o usuário identificado
      return {
        responses: [
          {
            to: session.phone,
            message: `🔄 Tudo bem! Vamos recomeçar.\n\n${MSG.USER_FOUND(session.glpiUserName || '')}`,
          },
        ],
        newState: ConversationState.AWAITING_TYPE,
        sessionUpdates: {
          ticketType: undefined,
          description: undefined,
          urgency: undefined,
          categoryId: undefined,
          categoryName: undefined,
          attemptCount: 0,
        },
      };
    }

    if (option !== '1') {
      return this.invalidInput(
        session,
        `⚠️ Por favor, responda:\n*1* - Confirmar\n*2* - Corrigir\n*0* - Cancelar`,
        ConversationState.AWAITING_CONFIRMATION
      );
    }

    // ─── Criação do Chamado no GLPI ─────────────────────────────────────
    try {
      const payload = buildGlpiPayload(session);
      logger.info('[Triagem] Criando chamado no GLPI:', JSON.stringify(payload, null, 2));

      const result = await glpiService.createTicket(payload);
      const ticketUrl = await glpiService.getTicketUrl(result.id);

      return {
        responses: [{ to: session.phone, message: MSG.TICKET_CREATED(result.id, ticketUrl) }],
        newState: ConversationState.COMPLETED,
        sessionUpdates: { glpiTicketId: result.id },
      };
    } catch (error) {
      logger.error('[Triagem] Erro ao criar chamado:', error);
      return {
        responses: [
          { to: session.phone, message: MSG.ERROR_CREATING, shouldTransfer: true },
        ],
        newState: ConversationState.TRANSFERRED,
        sessionUpdates: {},
      };
    }
  }

  // ─── Utilitários Internos ─────────────────────────────────────────────

  private invalidInput(
    session: ConversationSession,
    message: string,
    state: ConversationState
  ): TriagemResult {
    const attempts = (session.attemptCount || 0) + 1;
    if (attempts >= MAX_ATTEMPTS) return this.transfer(session);

    return {
      responses: [{ to: session.phone, message }],
      newState: state,
      sessionUpdates: { attemptCount: attempts },
    };
  }

  private transfer(session: ConversationSession): TriagemResult {
    return {
      responses: [
        { to: session.phone, message: MSG.TRANSFER, shouldTransfer: true },
      ],
      newState: ConversationState.TRANSFERRED,
      sessionUpdates: {},
    };
  }
}

export const triagemService = new TriagemService();
