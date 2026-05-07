import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import { AdminJSSequelize } from '@adminjs/sequelize';
import session from 'express-session';
import { Session } from '../src/models/session.model';

AdminJS.registerAdapter({ Resource: AdminJSSequelize.Resource, Database: AdminJSSequelize.Database });

const adminJs = new AdminJS({
  resources: [
    {
      resource: Session,
      options: {
        navigation: { name: 'Sessões WhatsApp', icon: 'Chat' },
        actions: {
          new: { isAccessible: false },
          edit: { isAccessible: false },
          delete: { isAccessible: true },
          bulkDelete: { isAccessible: true },
        },
        listProperties: ['phone', 'state', 'glpiUserName', 'glpiTicketId', 'lastActivityAt'],
        filterProperties: ['state', 'phone', 'glpiUserName'],
        showProperties: [
          'id', 'phone', 'state', 'glpiUserId', 'glpiUserName', 'glpiUserEmail',
          'ticketType', 'urgency', 'categoryName', 'glpiTicketId',
          'attemptCount', 'lastActivityAt', 'expiresAt', 'createdAt',
        ],
      },
    },
  ],
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
