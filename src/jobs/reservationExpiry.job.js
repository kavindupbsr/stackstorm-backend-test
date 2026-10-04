const reservationService = require('../services/reservation.service');
const { logger } = require('../config/logger');

let expiryTimer = null;

/**
 * Runs a single sweep reverting all expired temporary reservations.
 *
 * @returns {Promise<number>} Number of reverted reservations
 */
const runExpirySweep = async () => {
  try {
    const count = await reservationService.releaseExpiredReservations();
    if (count > 0) {
      logger.info(
        `[ReservationExpiryJob] Swept and released ${count} expired stock reservation(s)`
      );
    }
    return count;
  } catch (error) {
    logger.error(`[ReservationExpiryJob] Error in expiry sweep: ${error.message}`);
    return 0;
  }
};

/**
 * Starts the periodic reservation expiry background worker.
 *
 * @param {number} [intervalMs=60000] - Interval between sweeps (default: 60s)
 */
const startReservationExpiryJob = (intervalMs = 60000) => {
  if (expiryTimer) {
    clearInterval(expiryTimer);
  }

  expiryTimer = setInterval(async () => {
    await runExpirySweep();
  }, intervalMs);

  if (typeof expiryTimer.unref === 'function') {
    expiryTimer.unref(); // Do not block Node.js process exit during tests
  }

  logger.info(`[ReservationExpiryJob] Background worker started with interval ${intervalMs}ms`);
};

/**
 * Stops the periodic reservation expiry background worker.
 */
const stopReservationExpiryJob = () => {
  if (expiryTimer) {
    clearInterval(expiryTimer);
    expiryTimer = null;
    logger.info('[ReservationExpiryJob] Background worker stopped');
  }
};

module.exports = {
  startReservationExpiryJob,
  stopReservationExpiryJob,
  runExpirySweep,
};
