const { Model, DataTypes } = require('sequelize');

class ProductImage extends Model {
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
        image_url: {
          type: DataTypes.STRING,
          allowNull: false,
          validate: {
            notEmpty: {
              msg: 'Image URL cannot be empty',
            },
          },
        },
        alt_text: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        is_primary: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          allowNull: false,
        },
        display_order: {
          type: DataTypes.INTEGER,
          defaultValue: 0,
          allowNull: false,
          validate: {
            min: {
              args: [0],
              msg: 'Display order cannot be negative',
            },
          },
        },
      },
      {
        sequelize,
        modelName: 'ProductImage',
        tableName: 'product_images',
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
  }
}

module.exports = ProductImage;
