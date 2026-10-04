/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('orders', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      order_number: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      customer_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      order_status: {
        type: Sequelize.ENUM(
          'pending',
          'processing',
          'shipped',
          'delivered',
          'cancelled',
          'refunded'
        ),
        defaultValue: 'pending',
        allowNull: false,
      },
      payment_status: {
        type: Sequelize.ENUM('pending', 'paid', 'failed', 'refunded'),
        defaultValue: 'pending',
        allowNull: false,
      },
      total_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      shipping_amount: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0.0,
        allowNull: false,
      },
      discount_amount: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0.0,
        allowNull: false,
      },
      shipping_address_snapshot: {
        type: Sequelize.JSONB,
        allowNull: false,
      },
      billing_address_snapshot: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      guest_email: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      guest_phone: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      notes: {
        type: Sequelize.TEXT,
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

    await queryInterface.addIndex('orders', ['order_number'], {
      unique: true,
      name: 'idx_orders_order_number_unique',
    });

    await queryInterface.addIndex('orders', ['customer_id'], {
      name: 'idx_orders_customer_id',
    });

    await queryInterface.addIndex('orders', ['order_status'], {
      name: 'idx_orders_order_status',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('orders');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_orders_order_status;');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_orders_payment_status;');
  },
};
