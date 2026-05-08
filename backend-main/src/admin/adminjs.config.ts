import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import { Resource, Database } from '@adminjs/sequelize';
import { Session } from '../models/session.model';
import { TicketNotification } from '../models/ticket-notification.model';
import { ticketNotificationService } from '../services/ticket-notification.service';

AdminJS.registerAdapter({ Resource, Database });

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
          'entityName', 'ticketType', 'urgency', 'categoryName', 'glpiTicketId',
          'registerName', 'registerEmail',
          'attemptCount', 'lastActivityAt', 'expiresAt', 'createdAt',
        ],
      },
    },
    {
      resource: TicketNotification,
      options: {
        navigation: { name: 'Notificações de Chamados', icon: 'Notification' },
        actions: {
          new: { isAccessible: false },
          edit: { isAccessible: false },
          delete: { isAccessible: true },
          bulkDelete: { isAccessible: true },
          forcarEnvio: {
            actionType: 'resource',
            label: 'Forçar Envio Agora',
            icon: 'Send',
            component: false,
            handler: async (_req: any, _res: any, context: any) => {
              await ticketNotificationService.checkUpdates(true);
              return {
                redirectUrl: context.h.resourceUrl({ resourceId: context.resource.id() }),
                notice: {
                  message: 'Notificações verificadas e enviadas com sucesso!',
                  type: 'success',
                },
              };
            },
          },
        },
        listProperties: ['phone', 'glpiTicketId', 'lastFollowupId', 'lastStatus', 'createdAt'],
        showProperties: ['id', 'phone', 'glpiTicketId', 'lastFollowupId', 'lastStatus', 'createdAt', 'updatedAt'],
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
