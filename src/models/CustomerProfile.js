const { Model, DataTypes } = require('sequelize');

class CustomerProfile extends Model {
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
          unique: true,
          references: {
            model: 'users',
            key: 'id',
          },
        },
        phone: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        loyalty_tier: {
          type: DataTypes.ENUM('silver', 'gold', 'platinum'),
          defaultValue: 'silver',
          allowNull: false,
          validate: {
            isIn: {
              args: [['silver', 'gold', 'platinum']],
              msg: 'Loyalty tier must be silver, gold, or platinum',
            },
          },
        },
        marketing_opt_in: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          allowNull: false,
        },
      },
      {
        sequelize,
        modelName: 'CustomerProfile',
        tableName: 'customer_profiles',
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
  }
}

module.exports = CustomerProfile;
