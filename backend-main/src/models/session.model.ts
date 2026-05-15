import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import { ConversationState } from '../types/conversation.types';
import { GlpiTicketType, GlpiUrgency } from '../types/glpi.types';

interface SessionAttributes {
  id: string;
  phone: string;
  state: ConversationState;
  attemptCount: number;
  glpiUserId: number | null;
  glpiUserName: string | null;
  glpiUserEmail: string | null;
  department: string | null;
  entityId: number | null;
  entityName: string | null;
  ticketType: GlpiTicketType | null;
  description: string | null;
  urgency: GlpiUrgency | null;
  categoryId: number | null;
  categoryName: string | null;
  glpiTicketId: number | null;
  registerName: string | null;
  registerEmail: string | null;
  lastActivityAt: Date;
  expiresAt: Date;
}

type SessionCreationAttributes = Optional<
  SessionAttributes,
  | 'attemptCount'
  | 'glpiUserId'
  | 'glpiUserName'
  | 'glpiUserEmail'
  | 'department'
  | 'entityId'
  | 'entityName'
  | 'ticketType'
  | 'description'
  | 'urgency'
  | 'categoryId'
  | 'categoryName'
  | 'glpiTicketId'
  | 'registerName'
  | 'registerEmail'
>;

export class Session
  extends Model<SessionAttributes, SessionCreationAttributes>
  implements SessionAttributes
{
  declare id: string;
  declare phone: string;
  declare state: ConversationState;
  declare attemptCount: number;
  declare glpiUserId: number | null;
  declare glpiUserName: string | null;
  declare glpiUserEmail: string | null;
  declare department: string | null;
  declare entityId: number | null;
  declare entityName: string | null;
  declare ticketType: GlpiTicketType | null;
  declare description: string | null;
  declare urgency: GlpiUrgency | null;
  declare categoryId: number | null;
  declare categoryName: string | null;
  declare glpiTicketId: number | null;
  declare registerName: string | null;
  declare registerEmail: string | null;
  declare lastActivityAt: Date;
  declare expiresAt: Date;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Session.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    phone: {
      type: DataTypes.STRING(30),
      allowNull: false,
      comment: 'JID WhatsApp: 5511999999999@s.whatsapp.net',
    },
    state: {
      type: DataTypes.ENUM(...Object.values(ConversationState)),
      allowNull: false,
      defaultValue: ConversationState.INITIAL,
    },
    attemptCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    glpiUserId: { type: DataTypes.INTEGER, allowNull: true },
    glpiUserName: { type: DataTypes.STRING(200), allowNull: true },
    glpiUserEmail: { type: DataTypes.STRING(200), allowNull: true },
    department: { type: DataTypes.STRING(20), allowNull: true },
    entityId: { type: DataTypes.INTEGER, allowNull: true },
    entityName: { type: DataTypes.STRING(200), allowNull: true },
    ticketType: { type: DataTypes.INTEGER, allowNull: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    urgency: { type: DataTypes.INTEGER, allowNull: true },
    categoryId: { type: DataTypes.INTEGER, allowNull: true },
    categoryName: { type: DataTypes.STRING(200), allowNull: true },
    glpiTicketId: { type: DataTypes.INTEGER, allowNull: true },
    registerName: { type: DataTypes.STRING(200), allowNull: true },
    registerEmail: { type: DataTypes.STRING(200), allowNull: true },
    lastActivityAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'conversation_sessions',
    indexes: [
      { fields: ['phone'], unique: true },
      { fields: ['state'] },
      { fields: ['expires_at'] },
    ],
  }
);

export default Session;
