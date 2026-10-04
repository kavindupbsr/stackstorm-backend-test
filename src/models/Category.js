const { Model, DataTypes } = require('sequelize');

class Category extends Model {
  static initModel(sequelize) {
    return super.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
          validate: {
            notEmpty: {
              msg: 'Category name cannot be empty',
            },
          },
        },
        slug: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
          validate: {
            notEmpty: {
              msg: 'Category slug cannot be empty',
            },
          },
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        parent_id: {
          type: DataTypes.UUID,
          allowNull: true,
          references: {
            model: 'categories',
            key: 'id',
          },
        },
        is_active: {
          type: DataTypes.BOOLEAN,
          defaultValue: true,
          allowNull: false,
        },
      },
      {
        sequelize,
        modelName: 'Category',
        tableName: 'categories',
        timestamps: true,
        underscored: true,
        hooks: {
          beforeValidate: (category) => {
            if (!category.slug && category.name) {
              // eslint-disable-next-line no-param-reassign
              category.slug = category.name
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '');
            } else if (category.slug) {
              // eslint-disable-next-line no-param-reassign
              category.slug = category.slug
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
      foreignKey: 'parent_id',
      as: 'parent',
    });

    this.hasMany(models.Category, {
      foreignKey: 'parent_id',
      as: 'children',
    });

    this.hasMany(models.Product, {
      foreignKey: 'category_id',
      as: 'products',
    });
  }
}

module.exports = Category;
