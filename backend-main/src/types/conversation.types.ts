import { GlpiTicketType, GlpiUrgency, Department } from './glpi.types';

export type { Department };

export enum ConversationState {
  INITIAL = 'INITIAL',

  // ─── Fluxo: usuário cadastrado ────────────────────────────────────────
  AWAITING_DEPARTMENT = 'AWAITING_DEPARTMENT',
  AWAITING_ENTITY = 'AWAITING_ENTITY',
  AWAITING_TYPE = 'AWAITING_TYPE', // mantido no enum para compatibilidade com DB existente
  AWAITING_DESCRIPTION = 'AWAITING_DESCRIPTION',
  AWAITING_URGENCY = 'AWAITING_URGENCY',
  AWAITING_CATEGORY = 'AWAITING_CATEGORY',
  AWAITING_CONFIRMATION = 'AWAITING_CONFIRMATION',

  // ─── Fluxo: usuário não cadastrado ───────────────────────────────────
  AWAITING_REGISTER_DECISION = 'AWAITING_REGISTER_DECISION',
  AWAITING_REGISTER_NAME = 'AWAITING_REGISTER_NAME',
  AWAITING_REGISTER_EMAIL = 'AWAITING_REGISTER_EMAIL',
  AWAITING_REGISTER_CONFIRM = 'AWAITING_REGISTER_CONFIRM',

  // ─── Estados finais ───────────────────────────────────────────────────
  COMPLETED = 'COMPLETED',
  TRANSFERRED = 'TRANSFERRED',
  CANCELLED = 'CANCELLED',
}

export interface ConversationSession {
  id: string;
  phone: string;
  state: ConversationState;
  attemptCount: number;

  // Usuário GLPI identificado
  glpiUserId?: number | null;
  glpiUserName?: string | null;
  glpiUserEmail?: string | null;

  // Departamento selecionado
  department?: Department | null;

  // Entidade selecionada
  entityId?: number | null;
  entityName?: string | null;

  // Dados do chamado
  ticketType?: GlpiTicketType | null;
  description?: string | null;
  urgency?: GlpiUrgency | null;
  categoryId?: number | null;
  categoryName?: string | null;
  glpiTicketId?: number | null;

  // Dados de cadastro (usuário não encontrado)
  registerName?: string | null;
  registerEmail?: string | null;

  lastActivityAt: Date;
  createdAt: Date;
  expiresAt: Date;
}

export interface IncomingMessage {
  instanceName: string;
  phone: string;
  pushName: string;
  messageText: string;
  messageId: string;
  timestamp: number;
}

export interface BotResponse {
  to: string;
  message: string;
  shouldTransfer?: boolean;
}

export interface TriagemResult {
  responses: BotResponse[];
  newState: ConversationState;
  sessionUpdates: Partial<ConversationSession>;
}
