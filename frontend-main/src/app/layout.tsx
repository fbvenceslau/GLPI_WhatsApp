import type { Metadata } from 'next';
import '../styles/globals.scss';

export const metadata: Metadata = {
  title: 'Chamados WhatsApp | Suporte Técnico',
  description: 'Sistema de abertura de chamados via WhatsApp integrado ao GLPI',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="d-flex">
          <nav className="sidebar d-flex flex-column p-3">
            <div className="mb-4">
              <h5 className="fw-bold text-white">Chamados WA</h5>
              <small className="text-white-50">Suporte via WhatsApp</small>
            </div>
            <ul className="nav flex-column gap-1">
              <li className="nav-item">
                <a href="/dashboard" className="nav-link px-3 py-2">Dashboard</a>
              </li>
              <li className="nav-item">
                <a href="/tickets" className="nav-link px-3 py-2">Chamados</a>
              </li>
            </ul>
          </nav>
          <main className="main-content flex-grow-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
