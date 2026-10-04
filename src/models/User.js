const { Model, DataTypes } = require('sequelize');

class User extends Model {
  static initModel(sequelize) {
    return super.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        email: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
          validate: {
            isEmail: {
              msg: 'Email must be a valid email address',
            },
            notEmpty: {
              msg: 'Email cannot be empty',
            },
          },
        },
        password_hash: {
          type: DataTypes.STRING,
          allowNull: false,
          validate: {
            notEmpty: {
              msg: 'Password hash cannot be empty',
            },
          },
        },
        role: {
          type: DataTypes.ENUM('customer', 'admin', 'inventory_staff', 'support_agent'),
          defaultValue: 'customer',
          allowNull: false,
          validate: {
            isIn: {
              args: [['customer', 'admin', 'inventory_staff', 'support_agent']],
              msg: 'Role must be customer, admin, inventory_staff, or support_agent',
            },
          },
        },
        is_active: {
          type: DataTypes.BOOLEAN,
          defaultValue: true,
          allowNull: false,
        },
        failed_login_attempts: {
          type: DataTypes.INTEGER,
          defaultValue: 0,
          allowNull: false,
          validate: {
            min: {
              args: [0],
              msg: 'Failed login attempts cannot be negative',
            },
          },
        },
      },
      {
        sequelize,
        modelName: 'User',
        tableName: 'users',
        timestamps: true,
        underscored: true,
        defaultScope: {
          attributes: { exclude: ['password_hash'] },
        },
        scopes: {
          withPassword: {
            attributes: { include: ['password_hash'] },
          },
        },
        hooks: {
          beforeValidate: (user) => {
            if (user.email && typeof user.email === 'string') {
              // eslint-disable-next-line no-param-reassign
              user.email = user.email.trim().toLowerCase();
            }
          },
        },
      }
    );
  }

  static associate(models) {
    this.hasOne(models.CustomerProfile, {
      foreignKey: 'user_id',
      as: 'customerProfile',
      onDelete: 'CASCADE',
    });

    this.hasMany(models.Address, {
      foreignKey: 'user_id',
      as: 'addresses',
      onDelete: 'CASCADE',
    });
  }
}

module.exports = User;
