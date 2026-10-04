const authorize = require('../../../src/middleware/authorize');
const { ROLES } = require('../../../src/config/constants');

describe('Unit: authorize Middleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      user: null,
    };
    res = {
      statusCode: null,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      },
    };
    next = jest.fn();
  });

  describe('Unauthenticated Requests', () => {
    it('should return 401 if req.user is undefined', () => {
      const middleware = authorize(ROLES.ADMIN);
      req.user = null;

      middleware(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(res.body).toMatchObject({
        success: false,
        message: 'Authentication required',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 if req.user exists but role is missing', () => {
      const middleware = authorize(ROLES.ADMIN);
      req.user = { id: 'usr-123', email: 'test@dickwella.lk' };

      middleware(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(res.body).toMatchObject({
        success: false,
        message: 'Access denied: insufficient permissions',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Role-Based Authorization Checks', () => {
    it('should reject customer accessing admin-only endpoint with 403', () => {
      const middleware = authorize(ROLES.ADMIN);
      req.user = { id: 'usr-123', email: 'customer@dickwella.lk', role: ROLES.CUSTOMER };

      middleware(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(res.body).toMatchObject({
        success: false,
        message: 'Access denied: insufficient permissions',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow admin accessing admin-only endpoint', () => {
      const middleware = authorize(ROLES.ADMIN);
      req.user = { id: 'usr-999', email: 'admin@dickwella.lk', role: ROLES.ADMIN };

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.statusCode).toBeNull();
    });

    it('should allow inventory staff accessing inventory endpoint', () => {
      const middleware = authorize(ROLES.ADMIN, ROLES.INVENTORY);
      req.user = { id: 'usr-456', email: 'inventory@dickwella.lk', role: ROLES.INVENTORY };

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.statusCode).toBeNull();
    });

    it('should allow admin accessing inventory endpoint configured with multiple roles', () => {
      const middleware = authorize(ROLES.ADMIN, ROLES.INVENTORY);
      req.user = { id: 'usr-999', email: 'admin@dickwella.lk', role: ROLES.ADMIN };

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.statusCode).toBeNull();
    });

    it('should reject customer accessing inventory endpoint', () => {
      const middleware = authorize(ROLES.ADMIN, ROLES.INVENTORY);
      req.user = { id: 'usr-123', email: 'customer@dickwella.lk', role: ROLES.CUSTOMER };

      middleware(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toBe('Access denied: insufficient permissions');
      expect(next).not.toHaveBeenCalled();
    });

    it('should support array arguments: authorize([ROLES.ADMIN, ROLES.SUPPORT])', () => {
      const middleware = authorize([ROLES.ADMIN, ROLES.SUPPORT]);
      req.user = { id: 'usr-789', email: 'support@dickwella.lk', role: ROLES.SUPPORT };

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});
