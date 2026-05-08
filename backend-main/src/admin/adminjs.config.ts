import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import { Resource, Database } from '@adminjs/sequelize';

import { sessionResource } from './resources/session.resource';
import { ticketNotificationResource } from './resources/ticket-notification.resource';
import ptBR from './locales/pt-BR';

AdminJS.registerAdapter({ Resource, Database });

const adminJs = new AdminJS({
  resources: [
    sessionResource,
    ticketNotificationResource,
  ],
  locale: ptBR,
  branding: {
    companyName: 'Chamados WhatsApp',
    logo: false,
    favicon: '/favicon.ico',
  },
  rootPath: '/admin',
});

export function buildAdminRouter() {
  return AdminJSExpress.buildAuthenticatedRouter(
    adminJs,
    {
      authenticate: async (email: string, password: string) => {
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@empresa.com';
        const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
        if (email === adminEmail && password === adminPass) {
          return { email };
        }
        return null;
      },
      cookieName: 'adminjs',
      cookiePassword: process.env.SESSION_SECRET || 'changeme-secret-long-string',
    },
    null,
    {
      resave: false,
      saveUninitialized: true,
      secret: process.env.SESSION_SECRET || 'changeme-secret-long-string',
    }
  );
}

export { adminJs };
