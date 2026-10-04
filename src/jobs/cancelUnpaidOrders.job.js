const cron = require('node-cron');
const { Op } = require('sequelize');
const { Order, OrderItem, ProductVariant, User, sequelize } = require('../models');
const emailService = require('../services/email.service');
const reservationService = require('../services/reservation.service');
const { logger } = require('../config/logger');

let cronTask = null;

/**
 * Sweeps the database for orders remaining in pending status longer than threshold hours
 * and automatically transitions them to 'cancelled', releasing any reserved stock.
 *
 * @param {object} [options]
 * @param {number} [options.thresholdHours=48] - Age threshold in hours
 * @returns {Promise<number>} Count of cancelled orders
 */
const cancelExpiredOrders = async ({ thresholdHours = 48 } = {}) => {
  const cutoffTime = new Date(Date.now() - thresholdHours * 60 * 60 * 1000);

  logger.info(
    `[CancelUnpaidOrdersJob] Running sweep for orders created before ${cutoffTime.toISOString()} (${thresholdHours}h threshold)`
  );

  let expiredOrders = [];

  try {
    if (sequelize && typeof sequelize.transaction === 'function') {
      expiredOrders = await Order.findAll({
        where: {
          payment_status: 'pending',
          order_status: 'pending',
          created_at: {
            [Op.lt]: cutoffTime,
          },
        },
        include: [
          {
            model: OrderItem,
            as: 'items',
          },
          {
            model: User,
            as: 'customer',
            attributes: ['id', 'email', 'role'],
          },
        ],
      });
    }
  } catch (err) {
    logger.error(`[CancelUnpaidOrdersJob] Error querying expired orders: ${err.message}`);
    return 0;
  }

  if (expiredOrders.length === 0) {
    logger.info('[CancelUnpaidOrdersJob] No expired unpaid orders found in sweep');
    return 0;
  }

  logger.info(
    `[CancelUnpaidOrdersJob] Found ${expiredOrders.length} expired unpaid order(s) to cancel`
  );

  let cancelledCount = 0;

  for (let i = 0; i < expiredOrders.length; i += 1) {
    const order = expiredOrders[i];
    try {
      // eslint-disable-next-line no-await-in-loop
      await sequelize.transaction(async (t) => {
        // 1. Lock Order for update
        const lockedOrder = await Order.findByPk(order.id, {
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        if (!lockedOrder || lockedOrder.payment_status !== 'pending') {
          return;
        }

        // 2. Release reserved variant stock
        const items = order.items || [];
        for (let j = 0; j < items.length; j += 1) {
          const item = items[j];
          if (item.product_variant_id) {
            // eslint-disable-next-line no-await-in-loop
            const variant = await ProductVariant.findByPk(item.product_variant_id, {
              transaction: t,
              lock: t.LOCK.UPDATE,
            });

            if (variant) {
              const currentReserved = variant.reserved_quantity || 0;
              const newReserved = Math.max(0, currentReserved - (item.quantity || 1));

              // eslint-disable-next-line no-await-in-loop
              await variant.update({ reserved_quantity: newReserved }, { transaction: t });

              logger.info(
                `[CancelUnpaidOrdersJob] Released reserved stock for variant ${variant.id}: ${currentReserved} -> ${newReserved}`
              );
            }
          }
        }

        // 3. Mark order as cancelled
        const existingNotes = lockedOrder.notes || '';
        const cancellationTag = 'auto_cancelled_unpaid';
        let updatedNotes = existingNotes;
        if (!existingNotes.includes(cancellationTag)) {
          updatedNotes = existingNotes ? `${existingNotes} | ${cancellationTag}` : cancellationTag;
        }

        await lockedOrder.update(
          {
            order_status: 'cancelled',
            notes: updatedNotes,
          },
          { transaction: t }
        );
      });

      // 4. Clean up any related Redis reservation keys if present
      try {
        // eslint-disable-next-line no-await-in-loop
        await reservationService.releaseReservation(order.id);
      } catch (redisErr) {
        logger.debug(
          `[CancelUnpaidOrdersJob] No Redis reservation found for order ${order.id}: ${redisErr.message}`
        );
      }

      // 5. Send automated cancellation email to customer
      try {
        // eslint-disable-next-line no-await-in-loop
        await emailService.sendOrderCancellationNotice({
          order,
          reason: 'auto_cancelled_unpaid',
        });
      } catch (emailErr) {
        logger.warn(
          `[CancelUnpaidOrdersJob] Failed to dispatch cancellation notice for ${order.id}: ${emailErr.message}`
        );
      }

      cancelledCount += 1;
      logger.info(
        `[CancelUnpaidOrdersJob] Successfully auto-cancelled order ${order.id} (${order.order_number})`
      );
    } catch (orderErr) {
      logger.error(
        `[CancelUnpaidOrdersJob] Failed to cancel order ${order.id}: ${orderErr.message}`
      );
    }
  }

  return cancelledCount;
};

/**
 * Starts the hourly background cron job.
 * Avoids running active timers in test environments to ensure clean Jest teardown.
 *
 * @param {string} [cronSchedule='0 * * * *'] - Standard 5-field cron expression (default: hourly)
 * @returns {object|null} Scheduled task or null if in test mode
 */
const startCancelUnpaidOrdersJob = (cronSchedule = '0 * * * *') => {
  if (process.env.NODE_ENV === 'test') {
    logger.info('[CancelUnpaidOrdersJob] Disabled in test environment');
    return null;
  }

  if (cronTask) {
    cronTask.stop();
  }

  cronTask = cron.schedule(cronSchedule, async () => {
    try {
      await cancelExpiredOrders();
    } catch (err) {
      logger.error(`[CancelUnpaidOrdersJob] Unhandled cron sweep error: ${err.message}`);
    }
  });

  logger.info(`[CancelUnpaidOrdersJob] Cron job registered with schedule: "${cronSchedule}"`);
  return cronTask;
};

/**
 * Stops active background cron task.
 */
const stopCancelUnpaidOrdersJob = () => {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
    logger.info('[CancelUnpaidOrdersJob] Background cron job stopped');
  }
};

module.exports = {
  cancelExpiredOrders,
  startCancelUnpaidOrdersJob,
  stopCancelUnpaidOrdersJob,
};
