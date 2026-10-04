/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('product_variants', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      product_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'products',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      sku: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      size: {
        type: Sequelize.ENUM('XS', 'S', 'M', 'L', 'XL', 'XXL', 'FREE'),
        defaultValue: 'FREE',
        allowNull: false,
      },
      color: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      stock_quantity: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      reserved_quantity: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      price_override: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('product_variants', ['sku'], {
      unique: true,
      name: 'idx_product_variants_sku_unique',
    });

    await queryInterface.addIndex('product_variants', ['product_id'], {
      name: 'idx_product_variants_product_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('product_variants');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_product_variants_size;');
  },
};
