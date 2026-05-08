import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface TicketNotificationAttributes {
  id: string;
  phone: string;
  glpiTicketId: number;
  lastFollowupId: number | null;
  lastStatus: number;
}

type TicketNotificationCreationAttributes = Optional<
  TicketNotificationAttributes,
  'id' | 'lastFollowupId'
>;

export class TicketNotification
  extends Model<TicketNotificationAttributes, TicketNotificationCreationAttributes>
  implements TicketNotificationAttributes
{
  declare id: string;
  declare phone: string;
  declare glpiTicketId: number;
  declare lastFollowupId: number | null;
  declare lastStatus: number;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

TicketNotification.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    phone: { type: DataTypes.STRING(30), allowNull: false },
    glpiTicketId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    lastFollowupId: { type: DataTypes.INTEGER, allowNull: true },
    lastStatus: { type: DataTypes.INTEGER, allowNull: false },
  },
  {
    sequelize,
    tableName: 'ticket_notifications',
    indexes: [{ fields: ['glpi_ticket_id'] }],
  }
);

export default TicketNotification;
