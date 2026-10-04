/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('loyalty_accounts', {
      customer_id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      points_balance: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      tier: {
        type: Sequelize.ENUM('silver', 'gold', 'platinum'),
        defaultValue: 'silver',
        allowNull: false,
      },
      lifetime_points: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
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

    await queryInterface.addConstraint('loyalty_accounts', {
      fields: ['points_balance'],
      type: 'check',
      name: 'check_loyalty_accounts_points_balance_positive',
      where: {
        points_balance: {
          [Sequelize.Op.gte]: 0,
        },
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('loyalty_accounts');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_loyalty_accounts_tier;');
  },
};
