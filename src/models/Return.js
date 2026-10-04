const { Model, DataTypes } = require('sequelize');

class Return extends Model {
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
        order_item_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: 'order_items',
            key: 'id',
          },
        },
        user_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id',
          },
        },
        type: {
          type: DataTypes.ENUM('return', 'exchange'),
          defaultValue: 'return',
          allowNull: false,
          validate: {
            isIn: {
              args: [['return', 'exchange']],
              msg: 'Type must be return or exchange',
            },
          },
        },
        reason: {
          type: DataTypes.TEXT,
          allowNull: false,
          validate: {
            notEmpty: {
              msg: 'Reason cannot be empty',
            },
          },
        },
        exchange_variant_id: {
          type: DataTypes.UUID,
          allowNull: true,
          references: {
            model: 'product_variants',
            key: 'id',
          },
        },
        status: {
          type: DataTypes.ENUM('requested', 'approved', 'rejected', 'completed'),
          defaultValue: 'requested',
          allowNull: false,
          validate: {
            isIn: {
              args: [['requested', 'approved', 'rejected', 'completed']],
              msg: 'Invalid return status',
            },
          },
        },
      },
      {
        sequelize,
        modelName: 'Return',
        tableName: 'returns',
        timestamps: true,
        underscored: true,
        validate: {
          exchangeRequiresVariant() {
            if (this.type === 'exchange' && !this.exchange_variant_id) {
              throw new Error('exchange_variant_id is required when return type is exchange');
            }
          },
        },
      }
    );
  }

  static associate(models) {
    this.belongsTo(models.Order, {
      foreignKey: 'order_id',
      as: 'order',
    });

    this.belongsTo(models.OrderItem, {
      foreignKey: 'order_item_id',
      as: 'orderItem',
    });

    this.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });

    this.belongsTo(models.ProductVariant, {
      foreignKey: 'exchange_variant_id',
      as: 'exchangeVariant',
    });
  }
}

module.exports = Return;
