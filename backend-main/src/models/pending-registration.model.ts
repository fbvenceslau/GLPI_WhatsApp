import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface PendingRegistrationAttributes {
  id: string;
  phone: string;
  glpiUserId: number;
  username: string;
  tempPassword: string;
  notified: boolean;
}

type PendingRegistrationCreationAttributes = Optional<
  PendingRegistrationAttributes,
  'notified'
>;

export class PendingRegistration
  extends Model<PendingRegistrationAttributes, PendingRegistrationCreationAttributes>
  implements PendingRegistrationAttributes
{
  declare id: string;
  declare phone: string;
  declare glpiUserId: number;
  declare username: string;
  declare tempPassword: string;
  declare notified: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

PendingRegistration.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    phone: { type: DataTypes.STRING(30), allowNull: false },
    glpiUserId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    username: { type: DataTypes.STRING(200), allowNull: false },
    tempPassword: { type: DataTypes.STRING(100), allowNull: false },
    notified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    sequelize,
    tableName: 'pending_registrations',
    indexes: [{ fields: ['notified'] }],
  }
);

export default PendingRegistration;
