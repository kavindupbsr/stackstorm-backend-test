const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authService = require('../../../src/services/auth.service');
const { sequelize, User, CustomerProfile, LoyaltyAccount } = require('../../../src/models');
const ApiError = require('../../../src/utils/ApiError');

describe('STORM-012: AuthService Unit Test Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getBcryptWorkFactor', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('should return 4 when NODE_ENV=test and no explicit BCRYPT_WORK_FACTOR', () => {
      delete process.env.BCRYPT_WORK_FACTOR;
      process.env.NODE_ENV = 'test';
      expect(authService.getBcryptWorkFactor()).toBe(4);
    });

    it('should return explicit BCRYPT_WORK_FACTOR when configured', () => {
      process.env.BCRYPT_WORK_FACTOR = '10';
      expect(authService.getBcryptWorkFactor()).toBe(10);
    });

    it('should return 12 when in development/production and no env override', () => {
      delete process.env.BCRYPT_WORK_FACTOR;
      process.env.NODE_ENV = 'development';
      expect(authService.getBcryptWorkFactor()).toBe(12);
    });
  });

  describe('register', () => {
    it('should throw 409 Conflict if email is already registered', async () => {
      const mockExistingUser = { id: 'usr-123', email: 'existing@test.lk' };
      const findOneSpy = jest.spyOn(User, 'findOne').mockResolvedValue(mockExistingUser);

      await expect(
        authService.register({
          email: 'existing@test.lk',
          password: 'Password@123',
          fullName: 'Test User',
        })
      ).rejects.toThrow(ApiError);

      await expect(
        authService.register({
          email: 'existing@test.lk',
          password: 'Password@123',
          fullName: 'Test User',
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        message: 'Email is already registered',
      });

      findOneSpy.mockRestore();
    });

    it('should hash password and execute atomic transaction creating User, Profile and LoyaltyAccount', async () => {
      const findOneSpy = jest.spyOn(User, 'findOne').mockResolvedValue(null);

      const mockUser = {
        id: 'usr-uuid-001',
        email: 'newcustomer@test.lk',
        role: 'customer',
        toJSON: () => ({
          id: 'usr-uuid-001',
          email: 'newcustomer@test.lk',
          role: 'customer',
          password_hash: '$2b$04$somehash',
        }),
      };

      const mockProfile = {
        id: 'prof-uuid-001',
        user_id: 'usr-uuid-001',
        loyalty_tier: 'silver',
      };

      const mockLoyalty = {
        customer_id: 'usr-uuid-001',
        tier: 'silver',
        points_balance: 0,
      };

      const userCreateSpy = jest.spyOn(User, 'create').mockResolvedValue(mockUser);
      const profileCreateSpy = jest.spyOn(CustomerProfile, 'create').mockResolvedValue(mockProfile);
      const loyaltyCreateSpy = jest.spyOn(LoyaltyAccount, 'create').mockResolvedValue(mockLoyalty);

      const transactionSpy = jest
        .spyOn(sequelize, 'transaction')
        .mockImplementation(async (callback) => {
          return callback({});
        });

      const result = await authService.register({
        email: 'newcustomer@test.lk',
        password: 'SecurePassword@123',
        fullName: 'Kamal Perera',
      });

      expect(findOneSpy).toHaveBeenCalledWith({
        where: { email: 'newcustomer@test.lk' },
      });
      expect(transactionSpy).toHaveBeenCalled();
      expect(userCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'newcustomer@test.lk',
          role: 'customer',
        }),
        expect.any(Object)
      );

      // Verify the password was hashed
      const createdArgs = userCreateSpy.mock.calls[0][0];
      expect(createdArgs.password_hash).not.toBe('SecurePassword@123');
      expect(bcrypt.compareSync('SecurePassword@123', createdArgs.password_hash)).toBe(true);

      // Verify profile creation
      expect(profileCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'usr-uuid-001',
          loyalty_tier: 'silver',
        }),
        expect.any(Object)
      );

      // Verify loyalty account creation
      expect(loyaltyCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_id: 'usr-uuid-001',
          tier: 'silver',
          points_balance: 0,
        }),
        expect.any(Object)
      );

      // Verify result payload does not expose password_hash
      expect(result.user).toBeDefined();
      expect(result.user.password_hash).toBeUndefined();
      expect(result.user.email).toBe('newcustomer@test.lk');
      expect(result.user.fullName).toBe('Kamal Perera');

      // Verify token
      expect(result.token).toBeDefined();
      const decoded = jwt.decode(result.token);
      expect(decoded.id).toBe('usr-uuid-001');
      expect(decoded.email).toBe('newcustomer@test.lk');

      // Verify loyalty
      expect(result.loyalty).toEqual({
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
