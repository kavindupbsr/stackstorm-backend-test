/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('returns', {
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
      order_item_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'order_items',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      type: {
        type: Sequelize.ENUM('return', 'exchange'),
        defaultValue: 'return',
        allowNull: false,
      },
      reason: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      exchange_variant_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'product_variants',
          key: 'id',
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      status: {
        type: Sequelize.ENUM('requested', 'approved', 'rejected', 'completed'),
        defaultValue: 'requested',
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

    await queryInterface.addIndex('returns', ['order_id'], {
      name: 'idx_returns_order_id',
    });

    await queryInterface.addIndex('returns', ['user_id'], {
      name: 'idx_returns_user_id',
    });

    await queryInterface.addIndex('returns', ['exchange_variant_id'], {
      name: 'idx_returns_exchange_variant_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('returns');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_returns_type;');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_returns_status;');
  },
};
