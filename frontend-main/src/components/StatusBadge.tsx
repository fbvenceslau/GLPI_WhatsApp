'use client';
import { Badge } from 'react-bootstrap';
import { STATUS_LABELS, STATUS_VARIANTS } from '../types/ticket.types';

interface Props { status: number }

export default function StatusBadge({ status }: Props) {
  return (
    <Badge bg={STATUS_VARIANTS[status] || 'secondary'} className="status-badge">
      {STATUS_LABELS[status] || 'Desconhecido'}
    </Badge>
  );
}
