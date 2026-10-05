const express = require('express');
const returnController = require('../controllers/return.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { ROLES } = require('../config/constants');

const router = express.Router();

/**
 * @route   POST /api/v1/returns
 * @desc    Submit a return or size exchange request for an eligible order item
 * @access  Private (Authenticated Customer)
 */
router.post('/', authenticate, returnController.requestReturn);

/**
 * @route   GET /api/v1/returns/my-returns
 * @desc    Get paginated return/exchange requests for the authenticated customer
 * @access  Private (Authenticated Customer)
 */
router.get('/my-returns', authenticate, returnController.getMyReturns);

/**
 * @route   GET /api/v1/returns
 * @desc    List all platform return and exchange requests with pagination and filters
 * @access  Private (Admin / Manager / Support)
 */
router.get(
  '/',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.SUPPORT),
  returnController.listAllReturns
);

/**
 * @route   GET /api/v1/returns/:id
 * @desc    Get return details, item snapshot, delivery window, and status
 * @access  Private (Customer Owner or Admin / Manager / Support)
 */
router.get('/:id', authenticate, returnController.getReturn);

/**
 * @route   PATCH /api/v1/returns/:id/approve
 * @desc    Approve return/exchange request, issue shipping label, reserve exchange stock
 * @access  Private (Admin / Manager / Support)
 */
router.patch(
  '/:id/approve',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.SUPPORT),
  returnController.approveReturn
);

/**
 * @route   PATCH /api/v1/returns/:id/reject
 * @desc    Reject return or exchange request with justification
 * @access  Private (Admin / Manager / Support)
 */
router.patch(
  '/:id/reject',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.SUPPORT),
  returnController.rejectReturn
);

/**
 * @route   PATCH /api/v1/returns/:id
 * @desc    Unified status transition endpoint per SDS §11.3
 * @access  Private (Admin / Manager / Support)
 */
router.patch(
  '/:id',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.SUPPORT),
  returnController.updateReturnStatus
);

module.exports = router;
