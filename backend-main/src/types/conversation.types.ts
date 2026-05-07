import { GlpiTicketType, GlpiUrgency } from './glpi.types';

export enum ConversationState {
  INITIAL = 'INITIAL',
  AWAITING_EMAIL = 'AWAITING_EMAIL',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  AWAITING_TYPE = 'AWAITING_TYPE',
  AWAITING_DESCRIPTION = 'AWAITING_DESCRIPTION',
  AWAITING_URGENCY = 'AWAITING_URGENCY',
  AWAITING_CATEGORY = 'AWAITING_CATEGORY',
  AWAITING_CONFIRMATION = 'AWAITING_CONFIRMATION',
  COMPLETED = 'COMPLETED',
  TRANSFERRED = 'TRANSFERRED',
  CANCELLED = 'CANCELLED',
}

export interface ConversationSession {
  id: string;
  phone: string;
  state: ConversationState;
  attemptCount: number;

  // Dados do usuário GLPI identificado
  glpiUserId?: number;
  glpiUserName?: string;
  glpiUserEmail?: string;

  // Dados do chamado sendo coletado
  ticketType?: GlpiTicketType;
  description?: string;
  urgency?: GlpiUrgency;
  categoryId?: number;
  categoryName?: string;
  glpiTicketId?: number;

  // Controle de sessão
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
