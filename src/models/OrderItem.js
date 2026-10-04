const { Model, DataTypes } = require('sequelize');

class OrderItem extends Model {
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
        product_variant_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: 'product_variants',
            key: 'id',
          },
        },
        quantity: {
          type: DataTypes.INTEGER,
          allowNull: false,
          validate: {
            min: {
              args: [1],
              msg: 'Quantity must be at least 1',
            },
          },
        },
        unit_price_at_purchase: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
          validate: {
            min: {
              args: [0],
              msg: 'Unit price cannot be negative',
            },
          },
        },
        total_price: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
          validate: {
            min: {
              args: [0],
              msg: 'Total price cannot be negative',
            },
          },
        },
        product_title_snapshot: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        variant_sku_snapshot: {
          type: DataTypes.STRING,
          allowNull: false,
        },
      },
      {
        sequelize,
        modelName: 'OrderItem',
        tableName: 'order_items',
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

    this.belongsTo(models.ProductVariant, {
      foreignKey: 'product_variant_id',
      as: 'variant',
    });

    this.hasOne(models.Return, {
      foreignKey: 'order_item_id',
      as: 'returnRecord',
    });
  }
}

module.exports = OrderItem;
