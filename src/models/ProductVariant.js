const { Model, DataTypes } = require('sequelize');

class ProductVariant extends Model {
  static initModel(sequelize) {
    return super.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        product_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: 'products',
            key: 'id',
          },
        },
        sku: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
          validate: {
            notEmpty: {
              msg: 'SKU cannot be empty',
            },
          },
        },
        size: {
          type: DataTypes.ENUM('XS', 'S', 'M', 'L', 'XL', 'XXL', 'FREE'),
          defaultValue: 'FREE',
          allowNull: false,
          validate: {
            isIn: {
              args: [['XS', 'S', 'M', 'L', 'XL', 'XXL', 'FREE']],
              msg: 'Size must be XS, S, M, L, XL, XXL, or FREE',
            },
          },
        },
        color: {
          type: DataTypes.STRING,
          allowNull: false,
          validate: {
            notEmpty: {
              msg: 'Color cannot be empty',
            },
          },
        },
        stock_quantity: {
          type: DataTypes.INTEGER,
          defaultValue: 0,
          allowNull: false,
          validate: {
            min: {
              args: [0],
              msg: 'Stock quantity cannot be negative',
            },
          },
        },
        reserved_quantity: {
          type: DataTypes.INTEGER,
          defaultValue: 0,
          allowNull: false,
          validate: {
            min: {
              args: [0],
              msg: 'Reserved quantity cannot be negative',
            },
          },
        },
        price_override: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: true,
          validate: {
            min: {
              args: [0],
              msg: 'Price override cannot be negative',
            },
          },
        },
        availableStock: {
          type: DataTypes.VIRTUAL,
          get() {
            const stock = this.getDataValue('stock_quantity') ?? 0;
            const reserved = this.getDataValue('reserved_quantity') ?? 0;
            return Math.max(0, stock - reserved);
          },
        },
      },
      {
        sequelize,
        modelName: 'ProductVariant',
        tableName: 'product_variants',
        timestamps: true,
        underscored: true,
      }
    );
  }

  static associate(models) {
    this.belongsTo(models.Product, {
      foreignKey: 'product_id',
      as: 'product',
    });

    this.hasMany(models.CartItem, {
      foreignKey: 'product_variant_id',
      as: 'cartItems',
      onDelete: 'CASCADE',
    });
  }
}

module.exports = ProductVariant;
