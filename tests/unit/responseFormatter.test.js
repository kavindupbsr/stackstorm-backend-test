const { successResponse, errorResponse } = require('../../src/utils/responseFormatter');

const createMockRes = () => {
  const res = {
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
  return res;
};

describe('STORM-003: responseFormatter Unit Tests', () => {
  describe('successResponse', () => {
    it('should format a default success response with 200 status code', () => {
      const res = createMockRes();
      successResponse(res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: null,
        message: 'Success',
        errors: [],
      });
      expect(Object.keys(res.body)).toEqual(['success', 'data', 'message', 'errors']);
    });

    it('should format a success response with custom data, message, and 201 status code', () => {
      const res = createMockRes();
      const testData = { id: 'usr_123', name: 'Dickwella Retail' };
      successResponse(res, testData, 'Resource created successfully', 201);

      expect(res.statusCode).toBe(201);
      expect(res.body).toEqual({
        success: true,
        data: testData,
        message: 'Resource created successfully',
        errors: [],
      });
    });
  });

  describe('errorResponse', () => {
    it('should format a default error response with 500 status code', () => {
      const res = createMockRes();
      errorResponse(res);

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({
        success: false,
        data: null,
        message: 'An error occurred',
        errors: [],
      });
      expect(Object.keys(res.body)).toEqual(['success', 'data', 'message', 'errors']);
    });

    it('should format an error response with custom message, errors array, and 400 status code', () => {
      const res = createMockRes();
      const validationErrors = [
        { field: 'email', message: 'Email is required' },
        { field: 'password', message: 'Password must be at least 8 characters' },
      ];
      errorResponse(res, 'Validation Failed', validationErrors, 400);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        success: false,
        data: null,
        message: 'Validation Failed',
        errors: validationErrors,
      });
      expect(res.body.success).toBe(false);
      expect(res.body.data).toBeNull();
    });

    it('should wrap a single string error into an array automatically', () => {
      const res = createMockRes();
      errorResponse(res, 'Unauthorized access', 'Token expired', 401);

      expect(res.statusCode).toBe(401);
      expect(res.body.errors).toEqual(['Token expired']);
      expect(Array.isArray(res.body.errors)).toBe(true);
    });
  });
});
