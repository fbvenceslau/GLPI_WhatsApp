'use client';
import { useEffect, useState } from 'react';
import { Container, Spinner, Alert } from 'react-bootstrap';
import TicketCard from '../../components/TicketCard';
import { Ticket } from '../../types/ticket.types';
import api from '../../services/api';

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ data: Ticket[] }>('/api/tickets')
      .then((r) => setTickets(r.data.data))
      .catch(() => setError('Erro ao carregar chamados.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center mt-5"><Spinner animation="border" /></div>;
  if (error) return <Alert variant="danger">{error}</Alert>;

  return (
    <Container fluid>
      <h4 className="mb-4 fw-bold">Chamados Recentes</h4>
      {tickets.length === 0 ? (
        <Alert variant="info">Nenhum chamado encontrado.</Alert>
      ) : (
        tickets.map((t) => <TicketCard key={t.id} ticket={t} />)
      )}
    </Container>
  );
}
