const { Model, DataTypes } = require('sequelize');

class Payment extends Model {
  static initModel(sequelize) {
    return super.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        order_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: 'orders',
            key: 'id',
          },
        },
        payment_method: {
          type: DataTypes.ENUM('stripe', 'cod', 'bank_transfer'),
          defaultValue: 'stripe',
          allowNull: false,
          validate: {
            isIn: {
              args: [['stripe', 'cod', 'bank_transfer']],
              msg: 'Invalid payment method',
            },
          },
        },
        payment_intent_id: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        amount: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
          validate: {
            min: {
              args: [0],
              msg: 'Amount cannot be negative',
            },
          },
        },
        currency: {
          type: DataTypes.STRING,
          defaultValue: 'LKR',
          allowNull: false,
        },
        status: {
          type: DataTypes.ENUM('pending', 'succeeded', 'failed', 'refunded'),
          defaultValue: 'pending',
          allowNull: false,
          validate: {
            isIn: {
              args: [['pending', 'succeeded', 'failed', 'refunded']],
              msg: 'Invalid payment status',
            },
          },
        },
        raw_response: {
          type: DataTypes.JSONB,
          allowNull: true,
        },
      },
      {
        sequelize,
        modelName: 'Payment',
        tableName: 'payments',
        timestamps: true,
        underscored: true,
      }
    );
  }

  static associate(models) {
    this.belongsTo(models.Order, {
      foreignKey: 'order_id',
      as: 'order',
    });
  }
}

module.exports = Payment;
