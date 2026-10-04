/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('customer_profiles', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      phone: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      loyalty_tier: {
        type: Sequelize.ENUM('silver', 'gold', 'platinum'),
        defaultValue: 'silver',
        allowNull: false,
      },
      marketing_opt_in: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
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

    await queryInterface.addIndex('customer_profiles', ['user_id'], {
      unique: true,
      name: 'idx_customer_profiles_user_id_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('customer_profiles');
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS enum_customer_profiles_loyalty_tier;'
    );
  },
};
