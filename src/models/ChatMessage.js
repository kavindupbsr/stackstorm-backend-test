const { Model, DataTypes } = require('sequelize');

class ChatMessage extends Model {
  static initModel(sequelize) {
    return super.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        session_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: 'chat_sessions',
            key: 'id',
          },
        },
        sender_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id',
          },
        },
        sender_role: {
          type: DataTypes.ENUM('customer', 'support_agent', 'admin', 'system', 'bot'),
          defaultValue: 'customer',
          allowNull: false,
          validate: {
            isIn: {
              args: [['customer', 'support_agent', 'admin', 'system', 'bot']],
              msg: 'Invalid sender role',
            },
          },
        },
        message: {
          type: DataTypes.TEXT,
          allowNull: false,
          validate: {
            notEmpty: {
              msg: 'Message content cannot be empty',
            },
          },
        },
        is_read: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          allowNull: false,
        },
      },
      {
        sequelize,
        modelName: 'ChatMessage',
        tableName: 'chat_messages',
        timestamps: true,
        underscored: true,
      }
    );
  }

  static associate(models) {
    this.belongsTo(models.ChatSession, {
      foreignKey: 'session_id',
      as: 'session',
    });

    this.belongsTo(models.User, {
      foreignKey: 'sender_id',
      as: 'sender',
    });
  }
}

module.exports = ChatMessage;
