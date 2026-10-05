/* eslint-disable camelcase */
const { Op } = require('sequelize');
const { Return, Order, OrderItem, ProductVariant, Product, User, sequelize } = require('../models');
const { logger } = require('../config/logger');
const ApiError = require('../utils/ApiError');

/**
 * Validates and submits a new return or size exchange request for an order item.
 * Strictly enforces:
 *  1. Order status must be 'delivered'.
 *  2. Delivery date must be within 30 calendar days (delivered_at + 30 days).
 *  3. Product/OrderItem must NOT be final sale (is_final_sale === false).
 *  4. For exchanges, exchange_variant_id is required and must have available stock.
 *
 * @param {object} params
 * @param {string} params.userId - Authenticated customer ID requesting return
 * @param {string} params.order_item_id - Unique identifier of the purchased OrderItem
 * @param {('return'|'exchange')} [params.type='return'] - Return for refund or size exchange
 * @param {string} [params.exchange_variant_id] - Target variant UUID if type is exchange
 * @param {string} params.reason - Explanation / justification for return
 * @returns {Promise<object>} Created return request record
 */
const requestReturn = async ({
  userId,
  order_item_id,
  type = 'return',
  exchange_variant_id = null,
  reason,
}) => {
  if (!order_item_id) {
    throw ApiError.badRequest('order_item_id is required');
  }

  if (!['return', 'exchange'].includes(type)) {
    throw ApiError.badRequest('Type must be either "return" or "exchange"');
  }

  if (!reason || !String(reason).trim()) {
    throw ApiError.badRequest('Reason cannot be empty');
  }

  // 1. Fetch OrderItem with associated Order and Product details
  const orderItem = await OrderItem.findByPk(order_item_id, {
    include: [
      {
        model: Order,
        as: 'order',
      },
      {
        model: ProductVariant,
        as: 'variant',
        include: [
          {
            model: Product,
            as: 'product',
          },
        ],
      },
    ],
  });

  if (!orderItem) {
    throw ApiError.notFound('Order item not found');
  }

  const { order } = orderItem;
  if (!order) {
    throw ApiError.notFound('Associated order not found');
  }

  // 2. Ownership verification (if userId is supplied)
  if (userId && order.customer_id && order.customer_id !== userId) {
    throw ApiError.forbidden('You are not authorized to return items from this order');
  }

  // 3. Enforce order status must be 'delivered'
  if (order.order_status !== 'delivered') {
    throw ApiError.badRequest('Order must be delivered to request a return or exchange');
  }

  // 4. Enforce 30-Day Delivery Return Window
  const deliveryDate = order.delivered_at || order.updated_at;
  const now = new Date();
  const diffMs = now.getTime() - new Date(deliveryDate).getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays > 30) {
    throw ApiError.badRequest('Return window has expired (30 days from delivery date)');
  }

  // 5. Enforce Final-Sale Exclusion Rule
  const isFinalSale =
    orderItem.is_final_sale === true ||
    Boolean(orderItem.variant?.product?.is_final_sale);

  if (isFinalSale) {
    throw ApiError.badRequest('Final sale items cannot be returned or exchanged');
  }

  // 6. Check for duplicate pending or approved return for this item
  const existingReturn = await Return.findOne({
    where: {
      order_item_id: orderItem.id,
      status: {
        [Op.in]: ['requested', 'approved', 'completed'],
      },
    },
  });

  if (existingReturn) {
    throw ApiError.badRequest('A return or exchange request already exists for this order item');
  }

  // 7. For exchanges, validate target variant existence & stock availability
  let targetVariant = null;
  if (type === 'exchange') {
    if (!exchange_variant_id) {
      throw ApiError.badRequest('exchange_variant_id is required when return type is exchange');
    }

    targetVariant = await ProductVariant.findByPk(exchange_variant_id);
    if (!targetVariant) {
      throw ApiError.notFound('Target exchange variant not found');
    }

    const availableStock = Math.max(
      0,
      (targetVariant.stock_quantity ?? 0) - (targetVariant.reserved_quantity ?? 0)
    );

    if (availableStock < 1) {
      throw ApiError.badRequest('Target exchange variant has insufficient stock');
    }
  }

  // 8. Persist Return record
  const returnRecord = await Return.create({
    order_id: order.id,
    order_item_id: orderItem.id,
    user_id: userId || order.customer_id,
    type,
    reason: String(reason).trim(),
    exchange_variant_id: type === 'exchange' ? exchange_variant_id : null,
    status: 'requested',
  });

  logger.info(
    `[RETURN_SERVICE] Return request created: id=${returnRecord.id}, orderId=${order.id}, type=${type}`
  );

  return {
    return_id: returnRecord.id,
    id: returnRecord.id,
    order_id: returnRecord.order_id,
    order_item_id: returnRecord.order_item_id,
    user_id: returnRecord.user_id,
    type: returnRecord.type,
    reason: returnRecord.reason,
    exchange_variant_id: returnRecord.exchange_variant_id,
    status: returnRecord.status,
    created_at: returnRecord.created_at || returnRecord.createdAt,
    updated_at: returnRecord.updated_at || returnRecord.updatedAt,
  };
};

/**
 * Admin action: approves a requested return or exchange.
 * Generates return shipping label and, if an exchange, atomically reserves stock.
 *
 * @param {string} returnId - UUID of the Return record
 * @param {string} [adminId] - Staff / Admin performing approval
 * @returns {Promise<object>} Approved return record with shipping label
 */
const approveReturn = async (returnId, adminId = null) => {
  if (!returnId) {
    throw ApiError.badRequest('returnId is required');
  }

  const result = await sequelize.transaction(async (t) => {
    const returnRecord = await Return.findByPk(returnId, {
      include: [
        {
          model: OrderItem,
          as: 'orderItem',
        },
      ],
      transaction: t,
    });

    if (!returnRecord) {
      throw ApiError.notFound('Return request not found');
    }

    if (returnRecord.status !== 'requested') {
      throw ApiError.badRequest(`Return request is already ${returnRecord.status}`);
    }

    // Generate Return Shipping Label
    const trackingCode = `LABEL-RET-${returnRecord.id.slice(0, 8).toUpperCase()}`;
    const returnShippingLabelUrl = `https://shipping.stackstorm.internal/labels/${trackingCode}.pdf`;
    returnRecord.return_label_url = returnShippingLabelUrl;

    // If type is exchange, atomically reserve the target variant stock
    if (returnRecord.type === 'exchange' && returnRecord.exchange_variant_id) {
      const exchangeVariant = await ProductVariant.findByPk(returnRecord.exchange_variant_id, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!exchangeVariant) {
        throw ApiError.notFound('Exchange product variant not found');
      }

      const requestedQty = returnRecord.orderItem?.quantity || 1;
      const currentAvailable =
        (exchangeVariant.stock_quantity ?? 0) - (exchangeVariant.reserved_quantity ?? 0);

      if (currentAvailable < requestedQty) {
        throw ApiError.badRequest('Insufficient available stock to reserve for exchange');
      }

      exchangeVariant.reserved_quantity = (exchangeVariant.reserved_quantity ?? 0) + requestedQty;
      await exchangeVariant.save({ transaction: t });

      logger.info(
        `[RETURN_SERVICE] Reserved ${requestedQty} units of variant ${exchangeVariant.sku} for exchange ${returnRecord.id}`
      );
    }

    returnRecord.status = 'approved';
    await returnRecord.save({ transaction: t });

    return returnRecord;
  });

  logger.info(`[RETURN_SERVICE] Return ${returnId} approved by admin=${adminId}`);

  return {
    return_id: result.id,
    id: result.id,
    order_id: result.order_id,
    order_item_id: result.order_item_id,
    user_id: result.user_id,
    type: result.type,
    status: result.status,
    return_label_url: result.return_label_url,
    exchange_variant_id: result.exchange_variant_id,
    updated_at: result.updated_at || result.updatedAt,
  };
};

/**
 * Admin action: rejects a requested return or exchange.
 *
 * @param {string} returnId - UUID of the Return record
 * @param {string} [adminId] - Staff / Admin performing rejection
 * @param {string} [reason] - Reason for rejection
 * @returns {Promise<object>} Rejected return record
 */
const rejectReturn = async (returnId, adminId = null, reason = '') => {
  if (!returnId) {
    throw ApiError.badRequest('returnId is required');
  }

  const returnRecord = await Return.findByPk(returnId);
  if (!returnRecord) {
    throw ApiError.notFound('Return request not found');
  }

  if (returnRecord.status !== 'requested') {
    throw ApiError.badRequest(`Return request is already ${returnRecord.status}`);
  }

  returnRecord.status = 'rejected';
  await returnRecord.save();

  logger.info(
    `[RETURN_SERVICE] Return ${returnId} rejected by admin=${adminId}. Reason: ${reason}`
  );

  return {
    return_id: returnRecord.id,
    id: returnRecord.id,
    status: returnRecord.status,
    type: returnRecord.type,
    updated_at: returnRecord.updated_at || returnRecord.updatedAt,
  };
};

/**
 * Retrieves a single return record by ID with authorization checks.
 *
 * @param {string} returnId - UUID of the Return record
 * @param {object} user - Authenticated user object ({ id, role })
 * @returns {Promise<object>} Return details
 */
const getReturnById = async (returnId, user) => {
  if (!returnId) {
    throw ApiError.badRequest('returnId is required');
  }

  const returnRecord = await Return.findByPk(returnId, {
    include: [
      {
        model: Order,
        as: 'order',
        attributes: ['id', 'order_number', 'order_status', 'delivered_at', 'total_amount'],
      },
      {
        model: OrderItem,
        as: 'orderItem',
        attributes: [
          'id',
          'product_title_snapshot',
          'variant_sku_snapshot',
          'quantity',
          'unit_price_at_purchase',
          'total_price',
          'is_final_sale',
        ],
      },
      {
        model: ProductVariant,
        as: 'exchangeVariant',
        attributes: ['id', 'sku', 'size', 'color', 'stock_quantity', 'reserved_quantity'],
      },
    ],
  });

  if (!returnRecord) {
    throw ApiError.notFound('Return request not found');
  }

  // Authorization check: non-admin/manager can only view their own returns
  const isPrivileged = user && ['admin', 'manager', 'support'].includes(user.role);
  if (!isPrivileged && user && returnRecord.user_id !== user.id) {
    throw ApiError.forbidden('You do not have permission to view this return request');
  }

  return returnRecord;
};

/**
 * Retrieves paginated returns submitted by a specific customer.
 *
 * @param {string} userId - Customer UUID
 * @param {object} [options]
 * @param {number} [options.page=1]
 * @param {number} [options.limit=10]
 * @param {string} [options.status]
 * @returns {Promise<object>} Paginated returns
 */
const getUserReturns = async (userId, { page = 1, limit = 10, status } = {}) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
  const offset = (pageNum - 1) * limitNum;

  const whereClause = { user_id: userId };
  if (status) {
    whereClause.status = status;
  }

  const { count, rows } = await Return.findAndCountAll({
    where: whereClause,
    limit: limitNum,
    offset,
    order: [['created_at', 'DESC']],
    include: [
      {
        model: OrderItem,
        as: 'orderItem',
        attributes: ['id', 'product_title_snapshot', 'variant_sku_snapshot', 'quantity'],
      },
      {
        model: ProductVariant,
        as: 'exchangeVariant',
        attributes: ['id', 'sku', 'size', 'color'],
      },
    ],
  });

  return {
    returns: rows,
    total: count,
    page: pageNum,
    totalPages: Math.ceil(count / limitNum),
  };
};

/**
 * Retrieves all returns across the platform for Admin / Support dashboard.
 *
 * @param {object} [options]
 * @param {number} [options.page=1]
 * @param {number} [options.limit=20]
 * @param {string} [options.status]
 * @param {string} [options.type]
 * @returns {Promise<object>} Paginated returns with customer metadata
 */
const getAllReturns = async ({ page = 1, limit = 20, status, type } = {}) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  const whereClause = {};
  if (status) {
    whereClause.status = status;
  }
  if (type) {
    whereClause.type = type;
  }

  const { count, rows } = await Return.findAndCountAll({
    where: whereClause,
    limit: limitNum,
    offset,
    order: [['created_at', 'DESC']],
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'email', 'role'],
      },
      {
        model: Order,
        as: 'order',
        attributes: ['id', 'order_number', 'order_status', 'delivered_at'],
      },
      {
        model: OrderItem,
        as: 'orderItem',
        attributes: ['id', 'product_title_snapshot', 'variant_sku_snapshot', 'quantity'],
      },
      {
        model: ProductVariant,
        as: 'exchangeVariant',
        attributes: ['id', 'sku', 'size', 'color'],
      },
    ],
  });

  return {
    returns: rows,
    total: count,
    page: pageNum,
    totalPages: Math.ceil(count / limitNum),
  };
};

module.exports = {
  requestReturn,
  approveReturn,
  rejectReturn,
  getReturnById,
  getUserReturns,
  getAllReturns,
};
