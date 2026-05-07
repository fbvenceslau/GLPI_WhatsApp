export enum GlpiTicketType {
  INCIDENT = 1,
  REQUEST = 2,
}

export enum GlpiUrgency {
  VERY_LOW = 1,
  LOW = 2,
  MEDIUM = 3,
  HIGH = 4,
  VERY_HIGH = 5,
}

export enum GlpiImpact {
  VERY_LOW = 1,
  LOW = 2,
  MEDIUM = 3,
  HIGH = 4,
  VERY_HIGH = 5,
}

export enum GlpiStatus {
  NEW = 1,
  PROCESSING_ASSIGNED = 2,
  PROCESSING_PLANNED = 3,
  PENDING = 4,
  SOLVED = 5,
  CLOSED = 6,
}

export interface GlpiUser {
  id: number;
  name: string;
  realname: string;
  firstname: string;
  email: string;
  phone: string;
}

export interface GlpiCategory {
  id: number;
  name: string;
  completename: string;
  is_incident: number;
  is_request: number;
}

export interface GlpiTicketPayload {
  input: {
    name: string;
    content: string;
    type: GlpiTicketType;
    urgency: GlpiUrgency;
    impact: GlpiImpact;
    itilcategories_id: number;
    _users_id_requester: number;
    users_id_recipient: number;
    requesttypes_id: number;
    entities_id?: number;
  };
}

export interface GlpiTicketResponse {
  id: number;
  message: string;
}

export interface GlpiSessionToken {
  session_token: string;
}

export interface GlpiSearchResult<T> {
  totalcount: number;
  count: number;
  data: T[];
}

export const URGENCY_LABELS: Record<GlpiUrgency, string> = {
  [GlpiUrgency.VERY_LOW]: 'Muito Baixa',
  [GlpiUrgency.LOW]: 'Baixa',
  [GlpiUrgency.MEDIUM]: 'Média',
  [GlpiUrgency.HIGH]: 'Alta',
  [GlpiUrgency.VERY_HIGH]: 'Muito Alta',
};

export const TYPE_LABELS: Record<GlpiTicketType, string> = {
  [GlpiTicketType.INCIDENT]: 'Incidente',
  [GlpiTicketType.REQUEST]: 'Requisição',
};
