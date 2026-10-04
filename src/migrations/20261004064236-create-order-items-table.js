/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('order_items', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      order_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'orders',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      product_variant_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'product_variants',
          key: 'id',
        },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      unit_price_at_purchase: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      total_price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      product_title_snapshot: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      variant_sku_snapshot: {
        type: Sequelize.STRING,
        allowNull: false,
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

    await queryInterface.addIndex('order_items', ['order_id'], {
      name: 'idx_order_items_order_id',
    });

    await queryInterface.addIndex('order_items', ['product_variant_id'], {
      name: 'idx_order_items_product_variant_id',
    });

    await queryInterface.addConstraint('order_items', {
      fields: ['quantity'],
      type: 'check',
      name: 'check_order_items_quantity_positive',
      where: {
        quantity: {
          [Sequelize.Op.gt]: 0,
        },
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('order_items');
  },
};
