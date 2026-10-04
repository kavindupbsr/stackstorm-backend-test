/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('cart_items', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      guest_session_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      product_variant_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'product_variants',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      quantity: {
        type: Sequelize.INTEGER,
        defaultValue: 1,
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

    await queryInterface.addIndex('cart_items', ['user_id'], {
      name: 'idx_cart_items_user_id',
    });

    await queryInterface.addIndex('cart_items', ['guest_session_id'], {
      name: 'idx_cart_items_guest_session_id',
    });

    await queryInterface.addIndex('cart_items', ['product_variant_id'], {
      name: 'idx_cart_items_product_variant_id',
    });

    await queryInterface.addConstraint('cart_items', {
      fields: ['quantity'],
      type: 'check',
      name: 'check_cart_items_quantity_positive',
      where: {
        quantity: {
          [Sequelize.Op.gt]: 0,
        },
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('cart_items');
  },
};
