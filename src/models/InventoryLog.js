const { Model, DataTypes } = require('sequelize');

class InventoryLog extends Model {
  static initModel(sequelize) {
    return super.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        user_id: {
          type: DataTypes.UUID,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id',
          },
        },
        product_variant_id: {
          type: DataTypes.UUID,
          allowNull: true,
          references: {
            model: 'product_variants',
            key: 'id',
          },
        },
        sku: {
          type: DataTypes.STRING,
          allowNull: false,
          validate: {
            notEmpty: {
              msg: 'SKU cannot be empty',
            },
          },
        },
        quantity_change: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        previous_stock: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        new_stock: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        reason: {
          type: DataTypes.STRING,
          allowNull: false,
          validate: {
            notEmpty: {
              msg: 'Adjustment reason cannot be empty',
            },
          },
        },
      },
      {
        sequelize,
        modelName: 'InventoryLog',
        tableName: 'inventory_logs',
        timestamps: true,
        underscored: true,
      }
    );
  }

  static associate(models) {
    this.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });

    this.belongsTo(models.ProductVariant, {
      foreignKey: 'product_variant_id',
      as: 'variant',
    });
  }
}

module.exports = InventoryLog;
