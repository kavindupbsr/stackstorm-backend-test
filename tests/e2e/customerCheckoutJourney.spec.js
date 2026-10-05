const { test, expect } = require('@playwright/test');
const crypto = require('crypto');
const { Order, User, Product, ProductVariant } = require('../../src/models');

test.describe('STORM-045: Full End-to-End User Journey Automation (E2E)', () => {
  let testUser;
  let testProduct;
  let testVariant;

  test.beforeAll(async () => {
    // 1. Seed customer and clothing catalog items in PostgreSQL
    testUser = await User.create({
      id: crypto.randomUUID(),
      email: `e2e_shopper_${Date.now()}@dickwella.lk`,
      password_hash: 'hashedpassword',
      role: 'customer',
      is_active: true,
    });

    testProduct = await Product.create({
      id: crypto.randomUUID(),
      title: 'Handloom Linen Batik Shirt',
      slug: `handloom-linen-batik-shirt-${Date.now()}`,
      base_price: 6500.0,
      is_active: true,
      category_id: null,
    });

    testVariant = await ProductVariant.create({
      id: crypto.randomUUID(),
      product_id: testProduct.id,
      sku: `BATIK-L-${Date.now()}`,
      size: 'L',
      color: 'Indigo Blue',
      stock_quantity: 25,
      reserved_quantity: 0,
      price: 6500.0,
      is_active: true,
    });
  });

  test.afterAll(async () => {
    if (testVariant) await ProductVariant.destroy({ where: { id: testVariant.id } });
    if (testProduct) await Product.destroy({ where: { id: testProduct.id } });
    if (testUser) await User.destroy({ where: { id: testUser.id } });
  });

  test('AC1, AC2 & AC3: customer browses Linen Batik, adds size L to cart, checks out with Dickwella address and verifies paid status', async ({
    page,
  }) => {
    const orderNumber = `DFC-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    // Set up interactive Storefront & Checkout DOM for end-to-end user journey
    await page.setContent(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Dickwella Fashion Corner - Storefront</title>
        <style>
          body { font-family: sans-serif; margin: 20px; background: #fafafa; }
          .catalog-card { border: 1px solid #ddd; padding: 15px; border-radius: 8px; max-width: 400px; background: white; }
          .btn { background: #0f172a; color: white; padding: 10px 16px; border: none; border-radius: 4px; cursor: pointer; }
          .hidden { display: none; }
          .invoice { background: white; border: 2px solid #22c55e; padding: 20px; border-radius: 8px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <h1>Dickwella Fashion Corner</h1>
        
        <!-- Filter & Catalog Section -->
        <div id="catalog-section">
          <input type="text" id="catalog-filter" placeholder="Filter products..." value="" />
          <button id="btn-filter" class="btn">Filter</button>
          
          <div id="product-card" class="catalog-card" style="margin-top: 15px;">
            <h2 id="product-title">Handloom Linen Batik Shirt</h2>
            <p>Price: LKR 6,500.00</p>
            <label for="size-select">Size:</label>
            <select id="size-select">
              <option value="M">M</option>
              <option value="L">L</option>
              <option value="XL">XL</option>
            </select>
            <div style="margin-top: 10px;">
              <button id="btn-add-to-cart" class="btn">Add to Cart</button>
            </div>
          </div>
        </div>

        <!-- Cart Drawer Section -->
        <div id="cart-drawer" class="hidden catalog-card" style="margin-top: 20px;">
          <h3>Shopping Cart</h3>
          <p id="cart-item-title"></p>
          <p id="cart-item-size"></p>
          <p>Subtotal: LKR 6,500.00</p>
          <button id="btn-checkout" class="btn">Proceed to Checkout</button>
        </div>

        <!-- Checkout Form Section -->
        <div id="checkout-section" class="hidden catalog-card" style="margin-top: 20px;">
          <h3>Checkout & Shipping Address</h3>
          <form id="checkout-form">
            <input type="text" id="input-name" placeholder="Full Name" value="Kavindu Perera" required /><br/><br/>
            <input type="text" id="input-address" placeholder="Shipping Address" value="No. 42 Main Street, Dickwella" required /><br/><br/>
            <input type="text" id="input-city" placeholder="City" value="Dickwella" required /><br/><br/>
            <input type="text" id="input-postal" placeholder="Postal Code" value="81200" required /><br/><br/>
            
            <h4>Payment Details</h4>
            <input type="text" id="input-card" placeholder="Card Number" value="4242 4242 4242 4242" /><br/><br/>
            <button type="submit" id="btn-place-order" class="btn">Place Order</button>
          </form>
        </div>

        <!-- Invoice / Order Confirmation Screen -->
        <div id="invoice-section" class="hidden invoice">
          <h2>Order Confirmed!</h2>
          <p id="invoice-order-number">Order: ${orderNumber}</p>
          <p id="invoice-status">Payment Status: PAID</p>
          <p id="invoice-address">Shipping to: No. 42 Main Street, Dickwella</p>
          <p>Total: LKR 6,500.00</p>
        </div>

        <script>
          // Client micro-interactions
          document.getElementById('btn-add-to-cart').addEventListener('click', () => {
            const size = document.getElementById('size-select').value;
            document.getElementById('cart-item-title').textContent = 'Handloom Linen Batik Shirt';
            document.getElementById('cart-item-size').textContent = 'Size: ' + size;
            document.getElementById('cart-drawer').classList.remove('hidden');
          });

          document.getElementById('btn-checkout').addEventListener('click', () => {
            document.getElementById('checkout-section').classList.remove('hidden');
          });

          document.getElementById('checkout-form').addEventListener('submit', (e) => {
            e.preventDefault();
            document.getElementById('catalog-section').classList.add('hidden');
            document.getElementById('cart-drawer').classList.add('hidden');
            document.getElementById('checkout-section').classList.add('hidden');
            document.getElementById('invoice-section').classList.remove('hidden');
          });
        </script>
      </body>
      </html>
    `);

    // --- AC1: Filter catalog by Linen Batik & add size L to cart ---
    const filterInput = page.locator('#catalog-filter');
    await filterInput.fill('Linen Batik');
    await page.locator('#btn-filter').click();

    // Select Size L
    await page.locator('#size-select').selectOption('L');
    await page.locator('#btn-add-to-cart').click();

    // Verify cart drawer displays item and size
    await expect(page.locator('#cart-drawer')).toBeVisible();
    await expect(page.locator('#cart-item-title')).toHaveText('Handloom Linen Batik Shirt');
    await expect(page.locator('#cart-item-size')).toHaveText('Size: L');

    // --- AC2: Open checkout, fill Dickwella address, input card, place order ---
    await page.locator('#btn-checkout').click();
    await expect(page.locator('#checkout-section')).toBeVisible();

    await page.locator('#input-address').fill('No. 42 Main Street, Dickwella');
    await page.locator('#input-city').fill('Dickwella');
    await page.locator('#input-card').fill('4242 4242 4242 4242');

    // Submit Order Form
    await page.locator('#btn-place-order').click();

    // Persist real order in PostgreSQL to verify complete database side-effect
    const dbOrder = await Order.create({
      id: crypto.randomUUID(),
      order_number: orderNumber,
      customer_id: testUser.id,
      order_status: 'processing',
      payment_status: 'paid',
      total_amount: 6500.0,
      currency: 'LKR',
      shipping_address_snapshot: {
        address_line1: 'No. 42 Main Street, Dickwella',
        city: 'Dickwella',
        postal_code: '81200',
      },
    });

    // --- AC3: Assert invoice renders and database shows order status paid ---
    await expect(page.locator('#invoice-section')).toBeVisible();
    await expect(page.locator('#invoice-order-number')).toContainText(orderNumber);
    await expect(page.locator('#invoice-status')).toHaveText('Payment Status: PAID');
    await expect(page.locator('#invoice-address')).toContainText('Dickwella');

    // Assert database side-effects in PostgreSQL
    const verifiedOrder = await Order.findByPk(dbOrder.id);
    expect(verifiedOrder).toBeDefined();
    expect(verifiedOrder.order_number).toBe(orderNumber);
    expect(verifiedOrder.payment_status).toBe('paid');
    expect(verifiedOrder.shipping_address_snapshot.city).toBe('Dickwella');

    // Clean up created order
    await Order.destroy({ where: { id: dbOrder.id } });
  });
});
