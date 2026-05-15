import sequelize from '../config/database';
import logger from '../utils/logger';
import { Session } from './session.model';
import { PendingRegistration } from './pending-registration.model';
import { TicketNotification } from './ticket-notification.model';

export { Session, PendingRegistration, TicketNotification };

export async function syncDatabase(): Promise<void> {
  await sequelize.authenticate();
  await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
  logger.info('[DB] Conexão e sincronização concluídas.');
}

export default sequelize;
