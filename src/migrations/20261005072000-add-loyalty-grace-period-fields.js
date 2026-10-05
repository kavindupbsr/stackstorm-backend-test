/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('loyalty_accounts', 'annual_spend', {
      type: Sequelize.DECIMAL(10, 2),
      defaultValue: 0.0,
      allowNull: false,
    });

    await queryInterface.addColumn('loyalty_accounts', 'consecutive_below_threshold_quarters', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false,
    });

    await queryInterface.addColumn('loyalty_accounts', 'last_audit_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('loyalty_accounts', 'last_audit_at');
    await queryInterface.removeColumn('loyalty_accounts', 'consecutive_below_threshold_quarters');
    await queryInterface.removeColumn('loyalty_accounts', 'annual_spend');
  },
};
