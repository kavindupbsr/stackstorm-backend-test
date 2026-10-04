const lockoutService = require('../services/lockout.service');
const ApiError = require('../utils/ApiError');

/**
 * Express middleware intercepting login requests to check if the target account is locked in Redis.
 * If locked, sets the HTTP Retry-After header and rejects with HTTP 423 Locked.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const checkLockout = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return next();
    }

    const lockStatus = await lockoutService.isLocked(email);
    if (lockStatus.isLocked) {
      res.set('Retry-After', String(lockStatus.remainingSeconds));

      const message = `Account is locked due to 5 consecutive failed login attempts. Please try again in ${lockStatus.remainingMinutes} minute${
        lockStatus.remainingMinutes > 1 ? 's' : ''
      }.`;

      return next(
        ApiError.locked(message, [
          {
            field: 'email',
            message,
            retryAfterSeconds: lockStatus.remainingSeconds,
          },
        ])
      );
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = checkLockout;
