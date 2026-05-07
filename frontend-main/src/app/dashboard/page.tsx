'use client';
import { Card, Row, Col, Container } from 'react-bootstrap';

const STATS = [
  { label: 'Chamados Hoje', value: '—', color: 'primary' },
  { label: 'Em Atendimento', value: '—', color: 'warning' },
  { label: 'Resolvidos', value: '—', color: 'success' },
  { label: 'Sessões Ativas', value: '—', color: 'info' },
];

export default function DashboardPage() {
  return (
    <Container fluid>
      <h4 className="mb-4 fw-bold">Dashboard</h4>
      <Row className="g-3 mb-4">
        {STATS.map((s) => (
          <Col key={s.label} xs={12} sm={6} xl={3}>
            <Card className={`border-${s.color} border-start border-4`}>
              <Card.Body>
                <div className="text-muted small">{s.label}</div>
                <div className={`fs-3 fw-bold text-${s.color}`}>{s.value}</div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
      <Card>
        <Card.Body>
          <Card.Title>Fluxo do Sistema</Card.Title>
          <p className="text-muted small mb-0">
            WhatsApp → Evolution API → Webhook → Backend (Triagem ITIL) → GLPI API → Chamado criado
          </p>
        </Card.Body>
      </Card>
    </Container>
  );
}
