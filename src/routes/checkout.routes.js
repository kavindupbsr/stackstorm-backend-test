const express = require('express');
const checkoutController = require('../controllers/checkout.controller');
const optionalAuthenticate = require('../middleware/optionalAuthenticate');

const router = express.Router();

router.use(optionalAuthenticate);

/**
 * @route   POST /api/v1/checkout/initiate
 * @desc    Initiate checkout for guest or registered customer with shipping address
 * @access  Public (Guest or Authenticated)
 */
router.post('/initiate', checkoutController.initiate);

/**
 * @route   POST /api/v1/checkout/reserve
 * @desc    Reserve variant inventory for 15 minutes during checkout
 * @access  Public (Guest or Authenticated)
 */
router.post('/reserve', checkoutController.reserve);

/**
 * @route   POST /api/v1/checkout/release/:reservationId
 * @desc    Release reserved inventory back to available stock
 * @access  Public (Guest or Authenticated)
 */
router.post('/release/:reservationId', checkoutController.release);

/**
 * @route   POST /api/v1/checkout/confirm/:reservationId
 * @desc    Permanently deduct reserved inventory upon successful payment
 * @access  Public (Guest or Authenticated)
 */
router.post('/confirm/:reservationId', checkoutController.confirm);

module.exports = router;
