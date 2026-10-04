const request = require('supertest');
const app = require('../../src/app');
const { User, CustomerProfile, LoyaltyAccount, sequelize } = require('../../src/models');

describe('STORM-012: POST /api/v1/auth/register Integration Test Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    try {
      await sequelize.close();
    } catch {
      // Ignore cleanup error if not connected
    }
  });

  describe('Validation Failures (HTTP 400)', () => {
    it('should return 400 when email is missing or invalid', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        email: 'invalid-email-format',
        password: 'Password@123',
        fullName: 'Dilshan Silva',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Validation failed');
      expect(res.body.errors.some((e) => e.field === 'email')).toBe(true);
    });

    it('should return 400 when password does not meet complexity requirements', async () => {
      // Missing uppercase, number, special char, length < 8
      const res = await request(app).post('/api/v1/auth/register').send({
        email: 'user@test.lk',
        password: 'weak',
        fullName: 'Dilshan Silva',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors.some((e) => e.field === 'password')).toBe(true);
    });

    it('should return 400 when fullName is shorter than 2 characters', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        email: 'user@test.lk',
        password: 'StrongPassword@123',
        fullName: 'A',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors.some((e) => e.field === 'fullName')).toBe(true);
    });
  });

  describe('Conflict Handling (HTTP 409)', () => {
    it('should return 409 Conflict when attempting to register an existing email', async () => {
      const findOneSpy = jest.spyOn(User, 'findOne').mockResolvedValue({
        id: 'existing-uuid',
        email: 'duplicate@test.lk',
      });

      const res = await request(app).post('/api/v1/auth/register').send({
        email: 'duplicate@test.lk',
        password: 'StrongPassword@123',
        fullName: 'Dilshan Silva',
      });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Email is already registered');

      findOneSpy.mockRestore();
    });
  });

  describe('Successful Registration (HTTP 201)', () => {
    it('should return 201 Created with safe user object, token, and loyalty account', async () => {
      const findOneSpy = jest.spyOn(User, 'findOne').mockResolvedValue(null);

      const mockUser = {
        id: 'c1111111-2222-3333-4444-555555555555',
        email: 'newshopper@dickwellafashion.lk',
        role: 'customer',
        toJSON: () => ({
          id: 'c1111111-2222-3333-4444-555555555555',
          email: 'newshopper@dickwellafashion.lk',
          role: 'customer',
          password_hash: '$2b$04$samplehashedpassword',
        }),
      };

      const mockProfile = {
        id: 'p1111111-2222-3333-4444-555555555555',
        user_id: mockUser.id,
        loyalty_tier: 'silver',
      };

      const mockLoyalty = {
        customer_id: mockUser.id,
        tier: 'silver',
        points_balance: 0,
      };

      const userCreateSpy = jest.spyOn(User, 'create').mockResolvedValue(mockUser);
      const profileCreateSpy = jest.spyOn(CustomerProfile, 'create').mockResolvedValue(mockProfile);
      const loyaltyCreateSpy = jest.spyOn(LoyaltyAccount, 'create').mockResolvedValue(mockLoyalty);

      const transactionSpy = jest
        .spyOn(sequelize, 'transaction')
        .mockImplementation(async (cb) => cb({}));

      const res = await request(app).post('/api/v1/auth/register').send({
        email: 'newshopper@dickwellafashion.lk',
        password: 'SecurePassword@123',
        fullName: 'Anura Kumara',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('User registered successfully');

      // Verify response envelope & data payload
      const { data } = res.body;
      expect(data).toBeDefined();
      expect(data.user).toBeDefined();
      expect(data.user.id).toBe('c1111111-2222-3333-4444-555555555555');
      expect(data.user.email).toBe('newshopper@dickwellafashion.lk');
      expect(data.user.role).toBe('customer');

      // Crucial security check: password_hash must never leak
      expect(data.user.password_hash).toBeUndefined();

      // Verify JWT token is returned
      expect(data.token).toBeDefined();
      expect(typeof data.token).toBe('string');

      // Verify loyalty account initialized
      expect(data.loyalty).toEqual({
        tier: 'silver',
        points: 0,
      });

      findOneSpy.mockRestore();
      userCreateSpy.mockRestore();
      profileCreateSpy.mockRestore();
      loyaltyCreateSpy.mockRestore();
      transactionSpy.mockRestore();
    });
  });
});
