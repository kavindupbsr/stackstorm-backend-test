const sgMail = require('@sendgrid/mail');
const { logger } = require('../config/logger');

const { SENDGRID_API_KEY, EMAIL_FROM } = process.env;
const DEFAULT_FROM = EMAIL_FROM || 'orders@dickwella.lk';

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

// In-memory log of dispatched emails for unit testing and offline inspection
const dispatchedEmailsLog = [];

/**
 * Generates an HTML invoice and order confirmation template.
 *
 * @param {object} order - Order model or object
 * @param {Array<object>} items - Order line items
 * @param {string} invoiceNumber - Formatted invoice ID (e.g. DFC-2026-XXXX)
 * @returns {string} Clean HTML email document
 */
const generateInvoiceHtml = (order, items, invoiceNumber) => {
  const address = order.shipping_address_snapshot || {};
  const safeItems = Array.isArray(items) ? items : [];
  const itemsHtml = safeItems
    .map(
      (item) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">
          <strong>${item.product_title_snapshot || 'Product'}</strong><br/>
          <small style="color: #64748b;">SKU: ${item.variant_sku_snapshot || 'N/A'}</small>
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">LKR ${Number(item.unit_price_at_purchase).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600;">LKR ${Number(item.total_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
      </tr>
    `
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Order Confirmation - ${invoiceNumber}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
      <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        <div style="background: linear-gradient(135deg, #1e3a8a 0%, #0284c7 100%); padding: 32px; color: #ffffff;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Dickwella Fashion Corner</h1>
          <p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 14px;">Official Order Confirmation & Electronic Tax Invoice</p>
        </div>
        
        <div style="padding: 32px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 24px; border-bottom: 1px solid #f1f5f9; padding-bottom: 16px;">
            <div>
              <p style="margin: 0; font-size: 13px; color: #64748b;">Invoice Number</p>
              <p style="margin: 2px 0 0 0; font-size: 16px; font-weight: 700; color: #0f172a;">${invoiceNumber}</p>
            </div>
            <div>
              <p style="margin: 0; font-size: 13px; color: #64748b;">Order Number</p>
              <p style="margin: 2px 0 0 0; font-size: 16px; font-weight: 700; color: #0284c7;">${order.order_number}</p>
            </div>
          </div>

          <h2 style="font-size: 16px; font-weight: 600; margin: 20px 0 12px 0;">Purchased Items</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px;">
            <thead>
              <tr style="background: #f8fafc; color: #475569; text-align: left;">
                <th style="padding: 10px; font-weight: 600;">Item</th>
                <th style="padding: 10px; font-weight: 600; text-align: center;">Qty</th>
                <th style="padding: 10px; font-weight: 600; text-align: right;">Unit Price</th>
                <th style="padding: 10px; font-weight: 600; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div style="margin-left: auto; width: 280px; margin-bottom: 24px; font-size: 14px;">
            <div style="display: flex; justify-content: space-between; padding: 6px 0; color: #64748b;">
              <span>Subtotal:</span>
              <span>LKR ${(Number(order.total_amount) - Number(order.shipping_amount || 0) + Number(order.discount_amount || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 6px 0; color: #64748b;">
              <span>Shipping Courier:</span>
              <span>${Number(order.shipping_amount) === 0 ? 'FREE' : `LKR ${Number(order.shipping_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 8px 0; font-size: 16px; font-weight: 700; color: #0f172a; border-top: 2px solid #e2e8f0;">
              <span>Total Paid:</span>
              <span style="color: #059669;">LKR ${Number(order.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div style="background: #f8fafc; border-radius: 8px; padding: 16px; font-size: 13px; color: #475569; line-height: 1.6;">
            <strong>Shipping Destination:</strong><br/>
            ${address.line1 || ''}${address.line2 ? `, ${address.line2}` : ''}<br/>
            ${address.city || ''}, ${address.postal_code || ''}<br/>
            ${address.country || 'Sri Lanka'}
          </div>
        </div>

        <div style="background: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b;">
          Thank you for shopping with Dickwella Fashion Corner!<br/>
          Need assistance? Contact support@dickwella.lk or call +94 (41) 225-5000.
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Dispatches automated order confirmation email with itemized invoice.
 *
 * @param {object} params
 * @param {object} params.order - Order instance or data
 * @param {Array<object>} params.items - Order line items
 * @param {string} params.invoiceNumber - Unique invoice ID
 * @param {string} [params.recipientEmail] - Optional override email
 * @returns {Promise<object>} Dispatch summary
 */
const sendOrderConfirmation = async ({
  order,
  items = [],
  invoiceNumber,
  recipientEmail = null,
}) => {
  const targetEmail =
    recipientEmail ||
    order.guest_email ||
    (order.customer && order.customer.email) ||
    'customer@dickwella.lk';

  const htmlContent = generateInvoiceHtml(order, items, invoiceNumber);

  const emailPayload = {
    to: targetEmail,
    from: DEFAULT_FROM,
    subject: `Order Confirmation & Invoice [${invoiceNumber}] - Dickwella Fashion Corner`,
    html: htmlContent,
  };

  // Record dispatch in-memory for testing and auditing
  dispatchedEmailsLog.push({
    ...emailPayload,
    orderId: order.id,
    orderNumber: order.order_number,
    invoiceNumber,
    timestamp: new Date().toISOString(),
  });

  if (process.env.NODE_ENV === 'test' || !SENDGRID_API_KEY) {
    logger.info(
      `[SendGrid Simulated] Order confirmation dispatched to ${targetEmail} (Invoice: ${invoiceNumber})`
    );
    return {
      success: true,
      simulated: true,
      recipient: targetEmail,
      invoice_number: invoiceNumber,
    };
  }

  try {
    const [response] = await sgMail.send(emailPayload);
    logger.info(`[SendGrid Integration] Dispatched confirmation email to ${targetEmail}`);
    return {
      success: true,
      statusCode: response.statusCode,
      recipient: targetEmail,
      invoice_number: invoiceNumber,
    };
  } catch (err) {
    logger.error(`[SendGrid Error] Failed to send order confirmation email: ${err.message}`);
    return {
      success: false,
      error: err.message,
      recipient: targetEmail,
    };
  }
};

/**
 * Clears recorded email dispatch logs (useful for unit test teardown).
 */
const clearDispatchedLogs = () => {
  dispatchedEmailsLog.length = 0;
};

/**
 * Returns latest recorded dispatch log.
 */
const getLatestDispatchedEmail = () => {
  return dispatchedEmailsLog[dispatchedEmailsLog.length - 1] || null;
};

module.exports = {
  sendOrderConfirmation,
  generateInvoiceHtml,
  clearDispatchedLogs,
  getLatestDispatchedEmail,
  dispatchedEmailsLog,
};
