/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('payments', {
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
      payment_method: {
        type: Sequelize.ENUM('stripe', 'cod', 'bank_transfer'),
        defaultValue: 'stripe',
        allowNull: false,
      },
      payment_intent_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      currency: {
        type: Sequelize.STRING,
        defaultValue: 'LKR',
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('pending', 'succeeded', 'failed', 'refunded'),
        defaultValue: 'pending',
        allowNull: false,
      },
      raw_response: {
        type: Sequelize.JSONB,
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

    await queryInterface.addIndex('payments', ['order_id'], {
      name: 'idx_payments_order_id',
    });

    await queryInterface.addIndex('payments', ['payment_intent_id'], {
      name: 'idx_payments_payment_intent_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('payments');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_payments_payment_method;');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_payments_status;');
  },
};
