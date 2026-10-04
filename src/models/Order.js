const { Model, DataTypes } = require('sequelize');

class Order extends Model {
  static initModel(sequelize) {
    return super.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        order_number: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
        },
        customer_id: {
          type: DataTypes.UUID,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id',
          },
        },
        order_status: {
          type: DataTypes.ENUM(
            'pending',
            'processing',
            'shipped',
            'delivered',
            'cancelled',
            'refunded'
          ),
          defaultValue: 'pending',
          allowNull: false,
          validate: {
            isIn: {
              args: [['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']],
              msg: 'Invalid order status',
            },
          },
        },
        payment_status: {
          type: DataTypes.ENUM('pending', 'paid', 'failed', 'refunded'),
          defaultValue: 'pending',
          allowNull: false,
          validate: {
            isIn: {
              args: [['pending', 'paid', 'failed', 'refunded']],
              msg: 'Invalid payment status',
            },
          },
        },
        total_amount: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
          validate: {
            min: {
              args: [0],
              msg: 'Total amount cannot be negative',
            },
          },
        },
        shipping_amount: {
          type: DataTypes.DECIMAL(10, 2),
          defaultValue: 0.0,
          allowNull: false,
          validate: {
            min: {
              args: [0],
              msg: 'Shipping amount cannot be negative',
            },
          },
        },
        discount_amount: {
          type: DataTypes.DECIMAL(10, 2),
          defaultValue: 0.0,
          allowNull: false,
          validate: {
            min: {
              args: [0],
              msg: 'Discount amount cannot be negative',
            },
          },
        },
        shipping_address_snapshot: {
          type: DataTypes.JSONB,
          allowNull: false,
        },
        billing_address_snapshot: {
          type: DataTypes.JSONB,
          allowNull: true,
        },
        guest_email: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        guest_phone: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
      },
      {
        sequelize,
        modelName: 'Order',
        tableName: 'orders',
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

    this.hasMany(models.OrderItem, {
      foreignKey: 'order_id',
      as: 'items',
      onDelete: 'CASCADE',
    });

    this.hasMany(models.Payment, {
      foreignKey: 'order_id',
      as: 'payments',
      onDelete: 'CASCADE',
    });

    this.hasMany(models.Return, {
      foreignKey: 'order_id',
      as: 'returns',
      onDelete: 'CASCADE',
    });
  }
}

module.exports = Order;
