const { Model, DataTypes } = require('sequelize');

class Review extends Model {
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
        rating: {
          type: DataTypes.INTEGER,
          allowNull: false,
          validate: {
            min: {
              args: [1],
              msg: 'Rating must be between 1 and 5',
            },
            max: {
              args: [5],
              msg: 'Rating must be between 1 and 5',
            },
          },
        },
        title: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        comment: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        is_verified_purchase: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          allowNull: false,
        },
      },
      {
        sequelize,
        modelName: 'Review',
        tableName: 'reviews',
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

    this.belongsTo(models.Product, {
      foreignKey: 'product_id',
      as: 'product',
    });
  }
}

module.exports = Review;
