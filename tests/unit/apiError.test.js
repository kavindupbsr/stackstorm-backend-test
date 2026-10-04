const ApiError = require('../../src/utils/ApiError');

describe('STORM-004: ApiError Unit Tests', () => {
  it('should instantiate an ApiError with correct statusCode, message, and defaults', () => {
    const error = new ApiError(400, 'Invalid Request Data');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe('Invalid Request Data');
    expect(error.isOperational).toBe(true);
    expect(error.errors).toEqual([]);
    expect(error.stack).toBeDefined();
  });

  it('should wrap a single string error into an array within errors property', () => {
    const error = new ApiError(422, 'Validation Failure', 'Email already in use');

    expect(error.statusCode).toBe(422);
    expect(error.errors).toEqual(['Email already in use']);
  });

  it('should correctly support static factory methods', () => {
    const badRequest = ApiError.badRequest('Missing email field');
    expect(badRequest.statusCode).toBe(400);
    expect(badRequest.message).toBe('Missing email field');
    expect(badRequest.isOperational).toBe(true);

    const unauthorized = ApiError.unauthorized('Invalid access token');
    expect(unauthorized.statusCode).toBe(401);
    expect(unauthorized.message).toBe('Invalid access token');

    const forbidden = ApiError.forbidden('Admin role required');
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.message).toBe('Admin role required');

    const notFound = ApiError.notFound('Product variant not found');
    expect(notFound.statusCode).toBe(404);
    expect(notFound.message).toBe('Product variant not found');

    const internal = ApiError.internal('Database connection failed');
    expect(internal.statusCode).toBe(500);
    expect(internal.isOperational).toBe(false);
  });
});
