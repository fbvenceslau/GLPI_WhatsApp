export interface Ticket {
  id: number;
  name: string;
  content: string;
  type: 1 | 2;
  status: 1 | 2 | 3 | 4 | 5 | 6;
  urgency: 1 | 2 | 3 | 4 | 5;
  date: string;
  solvedate: string | null;
  users_id_recipient: number;
  itilcategories_id: number;
}

export const STATUS_LABELS: Record<number, string> = {
  1: 'Novo',
  2: 'Em Atendimento (atribuído)',
  3: 'Em Atendimento (planejado)',
  4: 'Pendente',
  5: 'Resolvido',
  6: 'Fechado',
};

export const STATUS_VARIANTS: Record<number, string> = {
  1: 'primary',
  2: 'warning',
  3: 'info',
  4: 'secondary',
  5: 'success',
  6: 'dark',
};

export const URGENCY_LABELS: Record<number, string> = {
  1: 'Muito Baixa',
  2: 'Baixa',
  3: 'Média',
  4: 'Alta',
  5: 'Muito Alta',
};

export const TYPE_LABELS: Record<number, string> = {
  1: 'Incidente',
  2: 'Requisição',
};

export interface ConversationSessionView {
  id: string;
  phone: string;
  state: string;
  glpiUserName: string | null;
  glpiTicketId: number | null;
  lastActivityAt: string;
}
