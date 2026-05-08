import { ConversationState, ConversationSession, TriagemResult } from '../types/conversation.types';
import { GlpiTicketType, GlpiUrgency, GlpiCategory, GlpiEntity, URGENCY_LABELS, TYPE_LABELS } from '../types/glpi.types';
import { glpiService } from './glpi.service';
import { registrationService } from './registration.service';
import { ticketNotificationService } from './ticket-notification.service';
import { glpiConfig } from '../config/glpi';
import { buildConfirmationSummary, buildGlpiPayload } from '../utils/payload.builder';
import logger from '../utils/logger';

const MAX_ATTEMPTS = 3;

// ─── Mensagens do Bot ──────────────────────────────────────────────────────

const MSG = {
  USER_FOUND: (name: string) =>
    `✅ Encontrei seu cadastro, *${name}*! Bem-vindo(a) ao Suporte Técnico.`,

  ASK_ENTITY: (entities: GlpiEntity[]) => {
    const lines = ['🏢 Para qual entidade você deseja abrir o chamado?\n'];
    entities.forEach((e, i) => lines.push(`*${i + 1}* - ${e.completename || e.name}`));
    lines.push('\n_Digite o número correspondente._');
    return lines.join('\n');
  },

  ASK_TYPE: `🎯 Como posso ajudar?\n\n*1* - 🔴 Incidente _(algo parou de funcionar)_\n*2* - 🔵 Requisição _(pedido de serviço ou recurso)_`,

  ASK_DESCRIPTION_INCIDENT: `🔴 *Incidente selecionado.*\n\nDescreva o problema:\n• O que parou de funcionar?\n• Desde quando?\n• Quantos usuários/sistemas afetados?\n• Há mensagem de erro?`,

  ASK_DESCRIPTION_REQUEST: `🔵 *Requisição selecionada.*\n\nDescreva o que você precisa:\n• O que está solicitando?\n• Qual a finalidade?\n• Há data limite?`,

  ASK_URGENCY: `⚡ Qual é a urgência?\n\n*1* - Muito Baixa _(pode aguardar)_\n*2* - Baixa\n*3* - Média _(padrão)_\n*4* - Alta _(impacto significativo)_\n*5* - Muito Alta _(ambiente parado)_`,

  INVALID_OPTION: (max: number) =>
    `⚠️ Opção inválida. Por favor, escolha entre *1* e *${max}*.`,

  TICKET_CREATED: (id: number, url: string) =>
    `🎉 *Chamado #${id} aberto com sucesso!*\n\nNossa equipe foi notificada e entrará em contato conforme o SLA.\n\n🔗 Acompanhe pelo portal:\n${url}\n\n_Obrigado por contatar o Suporte Técnico!_`,

  CANCELLED: `❌ Chamado cancelado. Caso precise de ajuda, é só enviar uma nova mensagem!`,

  ERROR_CREATING: `⚠️ Ocorreu um erro ao criar o chamado. Por favor, aguarde — um atendente irá ajudá-lo(a).`,

  TRANSFER: `🔄 Transferindo seu atendimento para um agente humano. Por favor, aguarde...`,

  LOOKUP_ERROR: `⚠️ Não foi possível verificar seu cadastro no momento. Por favor, tente novamente ou digite *HUMANO* para falar com um atendente.`,

  // Fluxo: usuário não cadastrado
  USER_NOT_FOUND: `❌ Não encontrei seu número WhatsApp em nosso sistema.\n\n*Deseja se cadastrar?*\n\n*1* - ✅ Sim, quero me cadastrar\n*2* - 🌐 Não, acessar o portal`,

  PORTAL_LINK: (url: string) =>
    `🌐 Acesse o portal para abrir seu chamado:\n${url}`,

  ASK_REGISTER_NAME: `👤 Qual é o seu *nome completo*?`,

  ASK_REGISTER_EMAIL: `📧 Qual é o seu *e-mail corporativo*?`,

  INVALID_EMAIL: `Por favor, informe um e-mail válido (ex: nome@empresa.com.br).`,

  REGISTER_CONFIRM: (name: string, email: string, phone: string) =>
    `📋 *Confirme seus dados de cadastro:*\n\n👤 *Nome:* ${name}\n📧 *E-mail:* ${email}\n📱 *WhatsApp:* ${phone}\n\n*1* - ✅ Confirmar\n*2* - ✏️ Corrigir`,

  REGISTER_PENDING: `✅ Dados enviados para aprovação! *Aguarde enquanto a T.I aprova o seu cadastro.*\n\nQuando aprovado, você receberá seu usuário e senha aqui pelo WhatsApp.`,

  REGISTER_ERROR: `⚠️ Não foi possível processar seu cadastro no momento. Por favor, entre em contato com a T.I diretamente.`,
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

function buildDisplayName(user: { name: string; firstname: unknown; realname: unknown }): string {
  const isNumeric = (s: string) => /^\d+$/.test(s.trim());
  const fn = String(user.firstname ?? '').trim();
  const rn = String(user.realname ?? '').trim();
  const validFn = fn && !isNumeric(fn) ? fn : '';
  if (validFn && rn) return `${validFn} ${rn}`;
  if (rn && !isNumeric(rn)) return rn;
  if (validFn) return validFn;
  return user.name;
}

// ─── Serviço de Triagem ────────────────────────────────────────────────────

export class TriagemService {

  async process(session: ConversationSession, userMessage: string): Promise<TriagemResult> {
    const text = userMessage.trim();

    if (['humano', 'atendente', 'pessoa', 'ajuda', 'help'].includes(text.toLowerCase())) {
      return this.transfer(session);
    }

    switch (session.state) {
      case ConversationState.INITIAL:
        return this.handleInitial(session);

      case ConversationState.AWAITING_ENTITY:
        return this.handleEntity(session, text);

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

      case ConversationState.AWAITING_REGISTER_DECISION:
        return this.handleRegisterDecision(session, text);

      case ConversationState.AWAITING_REGISTER_NAME:
        return this.handleRegisterName(session, text);

      case ConversationState.AWAITING_REGISTER_EMAIL:
        return this.handleRegisterEmail(session, text);

      case ConversationState.AWAITING_REGISTER_CONFIRM:
        return this.handleRegisterConfirm(session, text);

      default:
        return this.handleInitial(session);
    }
  }

  // ─── Fluxo: Usuário Cadastrado ────────────────────────────────────────

  private async handleInitial(session: ConversationSession): Promise<TriagemResult> {
    logger.info(`[Triagem] Identificando usuário pelo telefone: ${session.phone}`);

    try {
      const user = await glpiService.findUserByPhone(session.phone);

      if (!user) {
        return {
          responses: [{ to: session.phone, message: MSG.USER_NOT_FOUND }],
          newState: ConversationState.AWAITING_REGISTER_DECISION,
          sessionUpdates: { attemptCount: 0 },
        };
      }

      const displayName = buildDisplayName(user);

      const entities = await glpiService.getUserEntities(user.id);

      if (entities.length <= 1) {
        const entityId = entities[0]?.id ?? glpiConfig.defaultEntityId;
        const entityName = entities[0]?.completename || entities[0]?.name || '';

        return {
          responses: [
            { to: session.phone, message: MSG.USER_FOUND(displayName) },
            { to: session.phone, message: MSG.ASK_TYPE },
          ],
          newState: ConversationState.AWAITING_TYPE,
          sessionUpdates: {
            glpiUserId: user.id,
            glpiUserName: displayName,
            glpiUserEmail: user.email,
            entityId,
            entityName,
            attemptCount: 0,
          },
        };
      }

      return {
        responses: [
          { to: session.phone, message: MSG.USER_FOUND(displayName) },
          { to: session.phone, message: MSG.ASK_ENTITY(entities) },
        ],
        newState: ConversationState.AWAITING_ENTITY,
        sessionUpdates: {
          glpiUserId: user.id,
          glpiUserName: displayName,
          glpiUserEmail: user.email,
          description: JSON.stringify({ _entities: entities }),
          attemptCount: 0,
        },
      };
    } catch (error) {
      logger.error('[Triagem] Erro ao buscar usuário:', error);
      return {
        responses: [{ to: session.phone, message: MSG.LOOKUP_ERROR }],
        newState: ConversationState.INITIAL,
        sessionUpdates: {},
      };
    }
  }

  private handleEntity(session: ConversationSession, text: string): TriagemResult {
    let entities: GlpiEntity[] = [];

    try {
      const parsed = JSON.parse(session.description || '{}');
      if (parsed._entities) entities = parsed._entities;
    } catch {
      // no-op
    }

    const option = parseMenuOption(text, entities.length || 1);

    if (!option || !entities[option - 1]) {
      const attempts = (session.attemptCount || 0) + 1;
      if (attempts >= MAX_ATTEMPTS) return this.transfer(session);

      return {
        responses: [{
          to: session.phone,
          message: `${MSG.INVALID_OPTION(entities.length)}\n\n${MSG.ASK_ENTITY(entities)}`,
        }],
        newState: ConversationState.AWAITING_ENTITY,
        sessionUpdates: { attemptCount: attempts },
      };
    }

    const selected = entities[option - 1];

    return {
      responses: [{ to: session.phone, message: MSG.ASK_TYPE }],
      newState: ConversationState.AWAITING_TYPE,
      sessionUpdates: {
        entityId: selected.id,
        entityName: selected.completename || selected.name,
        description: null,
        attemptCount: 0,
      },
    };
  }

  private handleType(session: ConversationSession, text: string): TriagemResult {
    const option = parseMenuOption(text, 2);

    if (!option) {
      return this.invalidInput(session, MSG.INVALID_OPTION(2), ConversationState.AWAITING_TYPE);
    }

    const ticketType = option === 1 ? GlpiTicketType.INCIDENT : GlpiTicketType.REQUEST;
    const askDesc = ticketType === GlpiTicketType.INCIDENT
      ? MSG.ASK_DESCRIPTION_INCIDENT
      : MSG.ASK_DESCRIPTION_REQUEST;

    return {
      responses: [{ to: session.phone, message: askDesc }],
      newState: ConversationState.AWAITING_DESCRIPTION,
      sessionUpdates: { ticketType, attemptCount: 0 },
    };
  }

  private handleDescription(session: ConversationSession, text: string): TriagemResult {
    if (text.length < 10) {
      return {
        responses: [{
          to: session.phone,
          message: `⚠️ Descrição muito curta. Por favor, forneça mais detalhes (mínimo 10 caracteres).`,
        }],
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
    const categories = await glpiService.getCategories(session.ticketType ?? undefined);

    if (categories.length === 0) {
      logger.warn('[Triagem] Nenhuma categoria encontrada no GLPI, usando padrão.');
      const updatedSession = { ...session, urgency, categoryId: 0, categoryName: 'Não categorizado' };
      const summary = buildConfirmationSummary(updatedSession as ConversationSession);
      return {
        responses: [{ to: session.phone, message: summary }],
        newState: ConversationState.AWAITING_CONFIRMATION,
        sessionUpdates: { urgency, categoryId: 0, categoryName: 'Não categorizado' },
      };
    }

    return {
      responses: [{ to: session.phone, message: formatCategoryMenu(categories) }],
      newState: ConversationState.AWAITING_CATEGORY,
      sessionUpdates: {
        urgency,
        attemptCount: 0,
        description: JSON.stringify({ _categories: categories, _desc: session.description }),
      },
    };
  }

  private handleCategory(session: ConversationSession, text: string): TriagemResult {
    let categories: GlpiCategory[] = [];
    let originalDescription = session.description || '';

    try {
      const parsed = JSON.parse(session.description || '{}');
      if (parsed._categories) {
        categories = parsed._categories;
        originalDescription = parsed._desc || '';
      }
    } catch {
      // no-op
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
    if (text === '0') {
      return {
        responses: [{ to: session.phone, message: MSG.CANCELLED }],
        newState: ConversationState.CANCELLED,
        sessionUpdates: {},
      };
    }

    if (text === '2') {
      // Volta para seleção de tipo — reinicia dados do chamado
      return {
        responses: [{
          to: session.phone,
          message: `🔄 Tudo bem! Vamos recomeçar.\n\n${MSG.ASK_TYPE}`,
        }],
        newState: ConversationState.AWAITING_TYPE,
        sessionUpdates: {
          ticketType: null,
          description: null,
          urgency: null,
          categoryId: null,
          categoryName: null,
          attemptCount: 0,
        },
      };
    }

    if (text !== '1') {
      return this.invalidInput(
        session,
        `⚠️ Por favor, responda:\n*1* - ✅ Confirmar\n*2* - ✏️ Corrigir\n*0* - ❌ Cancelar`,
        ConversationState.AWAITING_CONFIRMATION
      );
    }

    try {
      const payload = buildGlpiPayload(session);
      logger.info('[Triagem] Criando chamado no GLPI:', JSON.stringify(payload, null, 2));

      const result = await glpiService.createTicket(payload);
      const ticketUrl = await glpiService.getTicketUrl(result.id);

      ticketNotificationService.track(session.phone, result.id, 1).catch((err) =>
        logger.error('[Triagem] Erro ao iniciar monitoramento do chamado:', err)
      );

      return {
        responses: [{ to: session.phone, message: MSG.TICKET_CREATED(result.id, ticketUrl) }],
        newState: ConversationState.COMPLETED,
        sessionUpdates: { glpiTicketId: result.id },
      };
    } catch (error) {
      logger.error('[Triagem] Erro ao criar chamado:', error);
      return {
        responses: [{ to: session.phone, message: MSG.ERROR_CREATING, shouldTransfer: true }],
        newState: ConversationState.TRANSFERRED,
        sessionUpdates: {},
      };
    }
  }

  // ─── Fluxo: Usuário Não Cadastrado ────────────────────────────────────

  private handleRegisterDecision(session: ConversationSession, text: string): TriagemResult {
    const option = parseMenuOption(text, 2);

    if (!option) {
      return this.invalidInput(
        session,
        MSG.USER_NOT_FOUND,
        ConversationState.AWAITING_REGISTER_DECISION
      );
    }

    if (option === 2) {
      return {
        responses: [{ to: session.phone, message: MSG.PORTAL_LINK(glpiConfig.portalUrl) }],
        newState: ConversationState.COMPLETED,
        sessionUpdates: {},
      };
    }

    return {
      responses: [{ to: session.phone, message: MSG.ASK_REGISTER_NAME }],
      newState: ConversationState.AWAITING_REGISTER_NAME,
      sessionUpdates: { attemptCount: 0 },
    };
  }

  private handleRegisterName(session: ConversationSession, text: string): TriagemResult {
    if (text.length < 3) {
      return {
        responses: [{ to: session.phone, message: `⚠️ Por favor, informe seu nome completo.` }],
        newState: ConversationState.AWAITING_REGISTER_NAME,
        sessionUpdates: {},
      };
    }

    return {
      responses: [{ to: session.phone, message: MSG.ASK_REGISTER_EMAIL }],
      newState: ConversationState.AWAITING_REGISTER_EMAIL,
      sessionUpdates: { registerName: text, attemptCount: 0 },
    };
  }

  private async handleRegisterEmail(
    session: ConversationSession,
    text: string
  ): Promise<TriagemResult> {
    if (!isValidEmail(text)) {
      return this.invalidInput(
        session,
        MSG.INVALID_EMAIL,
        ConversationState.AWAITING_REGISTER_EMAIL
      );
    }

    const email = text.toLowerCase().trim();

    // Verifica se o e-mail já existe no GLPI (ativo ou inativo)
    try {
      const existing = await glpiService.findUserByEmail(email);
      if (existing) {
        return {
          responses: [
            {
              to: session.phone,
              message: `⚠️ O e-mail *${email}* já está cadastrado no sistema.\n\nSe já possui acesso, utilize o portal:\n${glpiConfig.portalUrl}\n\nCaso tenha esquecido sua senha, solicite a redefinição pelo portal ou contate a T.I.`,
            },
            {
              to: session.phone,
              message: `_Atendimento encerrado. Quando precisar de suporte, é só nos enviar uma mensagem!_ 👋`,
            },
          ],
          newState: ConversationState.COMPLETED,
          sessionUpdates: {},
        };
      }
    } catch (error) {
      logger.error('[Triagem] Erro ao verificar e-mail no GLPI:', error);
      // Continua o fluxo normalmente em caso de falha na verificação
    }

    const phoneDisplay = session.phone.split('@')[0];

    return {
      responses: [{
        to: session.phone,
        message: MSG.REGISTER_CONFIRM(session.registerName!, email, phoneDisplay),
      }],
      newState: ConversationState.AWAITING_REGISTER_CONFIRM,
      sessionUpdates: { registerEmail: email, attemptCount: 0 },
    };
  }

  private async handleRegisterConfirm(
    session: ConversationSession,
    text: string
  ): Promise<TriagemResult> {
    const option = parseMenuOption(text, 2);
    const phoneDisplay = session.phone.split('@')[0];

    if (!option) {
      const attempts = (session.attemptCount || 0) + 1;
      if (attempts >= MAX_ATTEMPTS) return this.transfer(session);

      return {
        responses: [{
          to: session.phone,
          message: MSG.REGISTER_CONFIRM(
            session.registerName!,
            session.registerEmail!,
            phoneDisplay
          ),
        }],
        newState: ConversationState.AWAITING_REGISTER_CONFIRM,
        sessionUpdates: { attemptCount: attempts },
      };
    }

    if (option === 2) {
      return {
        responses: [{ to: session.phone, message: MSG.ASK_REGISTER_NAME }],
        newState: ConversationState.AWAITING_REGISTER_NAME,
        sessionUpdates: { registerName: null, registerEmail: null, attemptCount: 0 },
      };
    }

    // Opção 1: confirmado — cria usuário no GLPI como inativo (pendente de aprovação)
    let glpiResult: { id: number; username: string; tempPassword: string };

    try {
      glpiResult = await glpiService.createPendingUser({
        fullName: session.registerName!,
        email: session.registerEmail!,
        phoneJid: session.phone,
      });
    } catch (error) {
      logger.error('[Triagem] Falha ao criar usuário pendente no GLPI:', error);
      return {
        responses: [{ to: session.phone, message: MSG.REGISTER_ERROR }],
        newState: ConversationState.COMPLETED,
        sessionUpdates: {},
      };
    }

    // Salva registro para notificação quando a T.I aprovar
    try {
      await registrationService.savePending({
        phone: session.phone,
        glpiUserId: glpiResult.id,
        username: glpiResult.username,
        tempPassword: glpiResult.tempPassword,
      });
    } catch (error) {
      logger.error('[Triagem] Falha ao salvar registro pendente:', error);
      // Não interrompe — usuário já foi criado no GLPI
    }

    return {
      responses: [
        { to: session.phone, message: MSG.REGISTER_PENDING },
        { to: session.phone, message: MSG.PORTAL_LINK(glpiConfig.portalUrl) },
      ],
      newState: ConversationState.COMPLETED,
      sessionUpdates: {},
    };
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
      responses: [{ to: session.phone, message: MSG.TRANSFER, shouldTransfer: true }],
      newState: ConversationState.TRANSFERRED,
      sessionUpdates: {},
    };
  }
}

export const triagemService = new TriagemService();
