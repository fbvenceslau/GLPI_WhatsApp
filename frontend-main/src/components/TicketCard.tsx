'use client';
import { Card } from 'react-bootstrap';
import StatusBadge from './StatusBadge';
import { Ticket, TYPE_LABELS, URGENCY_LABELS } from '../types/ticket.types';

interface Props { ticket: Ticket }

export default function TicketCard({ ticket }: Props) {
  const openedAt = new Date(ticket.date).toLocaleString('pt-BR');
  return (
    <Card className="ticket-card mb-3">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-start">
          <div>
            <small className="text-muted">#{ticket.id}</small>
            <h6 className="mb-1 mt-1">{ticket.name}</h6>
            <div className="d-flex gap-2 flex-wrap">
              <span className="badge bg-light text-dark border">{TYPE_LABELS[ticket.type]}</span>
              <span className="badge bg-light text-dark border">
                Urgência: {URGENCY_LABELS[ticket.urgency]}
              </span>
            </div>
          </div>
          <StatusBadge status={ticket.status} />
        </div>
        <small className="text-muted d-block mt-2">Aberto em: {openedAt}</small>
      </Card.Body>
    </Card>
  );
}
