import { ticketNotificationService } from '../../services/ticket-notification.service';

export const forceNotificationsAction = {
  actionType: 'resource' as const,
  label: 'Forçar Envio Agora',
  icon: 'Send',
  component: false,
  handler: async (_req: any, _res: any, context: any) => {
    try {
      await ticketNotificationService.checkUpdates(true);
      return {
        redirectUrl: context.h.resourceUrl({ resourceId: context.resource.id() }),
        notice: {
          message: 'Notificações verificadas e enviadas com sucesso!',
          type: 'success',
        },
      };
    } catch (error) {
      return {
        redirectUrl: context.h.resourceUrl({ resourceId: context.resource.id() }),
        notice: {
          message: 'Erro ao verificar notificações. Consulte os logs.',
          type: 'error',
        },
      };
    }
  },
};
