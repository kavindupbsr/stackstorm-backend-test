const { Model, DataTypes } = require('sequelize');

class Product extends Model {
  static initModel(sequelize) {
    return super.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        category_id: {
          type: DataTypes.UUID,
          allowNull: true,
          references: {
            model: 'categories',
            key: 'id',
          },
        },
        title: {
          type: DataTypes.STRING,
          allowNull: false,
          validate: {
            notEmpty: {
              msg: 'Product title cannot be empty',
            },
          },
        },
        slug: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
          validate: {
            notEmpty: {
              msg: 'Product slug cannot be empty',
            },
          },
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        base_price: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
          validate: {
            min: {
              args: [0],
              msg: 'Base price cannot be negative',
            },
          },
        },
        is_active: {
          type: DataTypes.BOOLEAN,
          defaultValue: true,
          allowNull: false,
        },
        availableStock: {
          type: DataTypes.VIRTUAL,
          get() {
            if (this.variants && Array.isArray(this.variants)) {
              return this.variants.reduce(
                (total, variant) => total + (variant.availableStock || 0),
                0
              );
            }
            return 0;
          },
        },
      },
      {
        sequelize,
        modelName: 'Product',
        tableName: 'products',
        timestamps: true,
        underscored: true,
        hooks: {
          beforeValidate: (product) => {
            if (!product.slug && product.title) {
              // eslint-disable-next-line no-param-reassign
              product.slug = product.title
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '');
            } else if (product.slug) {
              // eslint-disable-next-line no-param-reassign
              product.slug = product.slug
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '');
            }
          },
        },
      }
    );
  }

  static associate(models) {
    this.belongsTo(models.Category, {
      foreignKey: 'category_id',
      as: 'category',
    });

    this.hasMany(models.ProductVariant, {
      foreignKey: 'product_id',
      as: 'variants',
      onDelete: 'CASCADE',
    });

    this.hasMany(models.ProductImage, {
      foreignKey: 'product_id',
      as: 'images',
      onDelete: 'CASCADE',
    });
  }
}

module.exports = Product;
