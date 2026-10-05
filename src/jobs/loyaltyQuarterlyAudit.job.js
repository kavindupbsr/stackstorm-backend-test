const loyaltyService = require('../services/loyalty.service');
const { logger } = require('../config/logger');

let auditTimer = null;

/**
 * Runs a quarterly loyalty audit evaluating spending and enforcing the 2-quarter grace period.
 *
 * @param {Date} [auditDate=new Date()]
 * @returns {Promise<object>} Summary report of audited accounts
 */
const runQuarterlyAudit = async (auditDate = new Date()) => {
  try {
    logger.info('[LoyaltyQuarterlyAuditJob] Starting quarterly tier evaluation sweep...');
    const report = await loyaltyService.evaluateQuarterlyDowngrades(auditDate);
    logger.info(
      `[LoyaltyQuarterlyAuditJob] Completed: ${report.total_audited} accounts audited, ${report.downgraded} downgraded, ${report.grace_period_retained} retained under grace period`
    );
    return report;
  } catch (error) {
    logger.error(`[LoyaltyQuarterlyAuditJob] Error executing quarterly audit: ${error.message}`);
    throw error;
  }
};

/**
 * Starts periodic quarterly audit background runner.
 *
 * @param {number} [intervalMs=86400000] - Interval between audits (default: 24h checks)
 */
const startLoyaltyQuarterlyAuditJob = (intervalMs = 86400000) => {
  if (auditTimer) {
    clearInterval(auditTimer);
  }

  auditTimer = setInterval(async () => {
    try {
      await runQuarterlyAudit();
    } catch (err) {
      logger.error(`[LoyaltyQuarterlyAuditJob] Unhandled error in periodic runner: ${err.message}`);
    }
  }, intervalMs);

  if (typeof auditTimer.unref === 'function') {
    auditTimer.unref(); // Prevent blocking test runner or process exit
  }

  logger.info(
    `[LoyaltyQuarterlyAuditJob] Background worker started with interval ${intervalMs}ms`
  );
};

/**
 * Stops periodic quarterly audit background runner.
 */
const stopLoyaltyQuarterlyAuditJob = () => {
  if (auditTimer) {
    clearInterval(auditTimer);
    auditTimer = null;
    logger.info('[LoyaltyQuarterlyAuditJob] Background worker stopped');
  }
};

module.exports = {
  runQuarterlyAudit,
  startLoyaltyQuarterlyAuditJob,
  stopLoyaltyQuarterlyAuditJob,
};
