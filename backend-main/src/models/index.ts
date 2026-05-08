import sequelize from '../config/database';
import { Session } from './session.model';
import { PendingRegistration } from './pending-registration.model';

export { Session, PendingRegistration };

export async function syncDatabase(): Promise<void> {
  await sequelize.authenticate();
  await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
  console.log('[DB] Conexão e sincronização concluídas.');
}

export default sequelize;
