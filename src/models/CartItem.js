const { Model, DataTypes } = require('sequelize');

class CartItem extends Model {
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
        guest_session_id: {
          type: DataTypes.STRING,
          allowNull: true,
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
          defaultValue: 1,
          allowNull: false,
          validate: {
            min: {
              args: [1],
              msg: 'Quantity must be at least 1',
            },
          },
        },
      },
      {
        sequelize,
        modelName: 'CartItem',
        tableName: 'cart_items',
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

module.exports = CartItem;
