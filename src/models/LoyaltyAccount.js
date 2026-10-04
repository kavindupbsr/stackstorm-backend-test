const { Model, DataTypes } = require('sequelize');

class LoyaltyAccount extends Model {
  static initModel(sequelize) {
    return super.init(
      {
        customer_id: {
          type: DataTypes.UUID,
          primaryKey: true,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id',
          },
        },
        points_balance: {
          type: DataTypes.INTEGER,
          defaultValue: 0,
          allowNull: false,
          validate: {
            min: {
              args: [0],
              msg: 'Points balance cannot be negative',
            },
          },
        },
        tier: {
          type: DataTypes.ENUM('silver', 'gold', 'platinum'),
          defaultValue: 'silver',
          allowNull: false,
          validate: {
            isIn: {
              args: [['silver', 'gold', 'platinum']],
              msg: 'Tier must be silver, gold, or platinum',
            },
          },
        },
        lifetime_points: {
          type: DataTypes.INTEGER,
          defaultValue: 0,
          allowNull: false,
          validate: {
            min: {
              args: [0],
              msg: 'Lifetime points cannot be negative',
            },
          },
        },
      },
      {
        sequelize,
        modelName: 'LoyaltyAccount',
        tableName: 'loyalty_accounts',
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
  }
}

module.exports = LoyaltyAccount;
