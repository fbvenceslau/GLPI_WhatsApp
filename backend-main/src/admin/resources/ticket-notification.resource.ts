import { TicketNotification } from '../../models/ticket-notification.model';
import { forceNotificationsAction } from '../actions/force-notifications.action';

export const ticketNotificationResource = {
  resource: TicketNotification,
  options: {
    navigation: { name: 'Notificações de Chamados', icon: 'Notification' },
    actions: {
      new: { isAccessible: false },
      edit: { isAccessible: false },
      delete: { isAccessible: true },
      bulkDelete: { isAccessible: true },
      forcarEnvio: forceNotificationsAction,
    },
    listProperties: [
      'phone',
      'glpiTicketId',
      'lastFollowupId',
      'lastStatus',
      'createdAt',
    ],
    showProperties: [
      'id',
      'phone',
      'glpiTicketId',
      'lastFollowupId',
      'lastStatus',
      'createdAt',
      'updatedAt',
    ],
  },
};
