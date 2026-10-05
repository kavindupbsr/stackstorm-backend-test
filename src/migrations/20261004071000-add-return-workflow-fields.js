/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add delivered_at to orders
    await queryInterface.addColumn('orders', 'delivered_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // Add is_final_sale to products
    await queryInterface.addColumn('products', 'is_final_sale', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    });

    // Add is_final_sale to order_items
    await queryInterface.addColumn('order_items', 'is_final_sale', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    });

    // Add return_label_url to returns
    await queryInterface.addColumn('returns', 'return_label_url', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('returns', 'return_label_url');
    await queryInterface.removeColumn('order_items', 'is_final_sale');
    await queryInterface.removeColumn('products', 'is_final_sale');
    await queryInterface.removeColumn('orders', 'delivered_at');
  },
};
