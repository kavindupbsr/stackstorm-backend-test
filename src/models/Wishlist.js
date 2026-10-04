const { Model, DataTypes } = require('sequelize');

class Wishlist extends Model {
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
          allowNull: false,
          references: {
            model: 'users',
            key: 'id',
          },
        },
        product_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: 'products',
            key: 'id',
          },
        },
      },
      {
        sequelize,
        modelName: 'Wishlist',
        tableName: 'wishlists',
        timestamps: true,
        underscored: true,
        indexes: [
          {
            unique: true,
            fields: ['user_id', 'product_id'],
            name: 'idx_wishlists_user_product_unique',
          },
        ],
      }
    );
  }

  static associate(models) {
    this.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });

    this.belongsTo(models.Product, {
      foreignKey: 'product_id',
      as: 'product',
    });
  }
}

module.exports = Wishlist;
