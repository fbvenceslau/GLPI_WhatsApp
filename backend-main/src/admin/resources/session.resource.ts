import { Session } from '../../models/session.model';

export const sessionResource = {
  resource: Session,
  options: {
    navigation: { name: 'Sessões WhatsApp', icon: 'Chat' },
    actions: {
      new: { isAccessible: false },
      edit: { isAccessible: false },
      delete: { isAccessible: true },
      bulkDelete: { isAccessible: true },
    },
    listProperties: [
      'phone',
      'state',
      'glpiUserName',
      'glpiTicketId',
      'lastActivityAt',
    ],
    filterProperties: [
      'state',
      'phone',
      'glpiUserName',
    ],
    showProperties: [
      'id',
      'phone',
      'state',
      'glpiUserId',
      'glpiUserName',
      'glpiUserEmail',
      'entityName',
      'ticketType',
      'urgency',
      'categoryName',
      'glpiTicketId',
      'registerName',
      'registerEmail',
      'attemptCount',
      'lastActivityAt',
      'expiresAt',
      'createdAt',
    ],
  },
};
