const { Model, DataTypes } = require('sequelize');

class ChatSession extends Model {
  static initModel(sequelize) {
    return super.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        customer_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id',
          },
        },
        agent_id: {
          type: DataTypes.UUID,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id',
          },
        },
        status: {
          type: DataTypes.ENUM('active', 'waiting', 'closed'),
          defaultValue: 'waiting',
          allowNull: false,
          validate: {
            isIn: {
              args: [['active', 'waiting', 'closed']],
              msg: 'Invalid chat session status',
            },
          },
        },
        subject: {
          type: DataTypes.STRING(255),
          allowNull: true,
        },
      },
      {
        sequelize,
        modelName: 'ChatSession',
        tableName: 'chat_sessions',
        timestamps: true,
        underscored: true,
      }
    );
  }

  static associate(models) {
    this.belongsTo(models.User, {
      foreignKey: 'customer_id',
      as: 'customer',
    });

    this.belongsTo(models.User, {
      foreignKey: 'agent_id',
      as: 'agent',
    });

    this.hasMany(models.ChatMessage, {
      foreignKey: 'session_id',
      as: 'messages',
    });
  }
}

module.exports = ChatSession;
