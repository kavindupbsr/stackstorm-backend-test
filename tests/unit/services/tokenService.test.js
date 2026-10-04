const jwt = require('jsonwebtoken');
const tokenService = require('../../../src/services/token.service');
const redisClient = require('../../../src/config/redis');
const { User } = require('../../../src/models');
const ApiError = require('../../../src/utils/ApiError');

describe('STORM-013: TokenService Unit Test Suite', () => {
  const mockUser = {
    id: 'usr-test-1111-2222-3333',
    email: 'customer@dickwellafashion.lk',
    role: 'customer',
    is_active: true,
    toJSON: () => ({
      id: 'usr-test-1111-2222-3333',
      email: 'customer@dickwellafashion.lk',
      role: 'customer',
      is_active: true,
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateAccessToken', () => {
    it('should generate a valid HMAC-SHA256 JWT containing sub, role, and email claims', () => {
      const token = tokenService.generateAccessToken(mockUser);
      expect(token).toBeDefined();

      const decoded = jwt.verify(token, tokenService.ACCESS_TOKEN_SECRET);
      expect(decoded.sub).toBe(mockUser.id);
      expect(decoded.id).toBe(mockUser.id);
      expect(decoded.email).toBe(mockUser.email);
      expect(decoded.role).toBe(mockUser.role);
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token and store it in Redis with 7-day TTL', async () => {
      const setexSpy = jest.spyOn(redisClient, 'setex');
      const { refreshToken, tokenId } = await tokenService.generateRefreshToken(mockUser);

      expect(refreshToken).toBeDefined();
      expect(tokenId).toBeDefined();

      const decoded = jwt.verify(refreshToken, tokenService.REFRESH_TOKEN_SECRET);
      expect(decoded.sub).toBe(mockUser.id);
      expect(decoded.tokenId).toBe(tokenId);

      expect(setexSpy).toHaveBeenCalledWith(
        `refresh_token:${mockUser.id}:${tokenId}`,
        7 * 24 * 60 * 60,
        'valid'
      );
      setexSpy.mockRestore();
    });
  });

  describe('verifyAccessToken & verifyRefreshToken', () => {
    it('verifyAccessToken should throw ApiError 401 when token is invalid or tampered', () => {
      expect(() => tokenService.verifyAccessToken('invalid.token.here')).toThrow(ApiError);
      expect(() => tokenService.verifyAccessToken('invalid.token.here')).toThrow(
        expect.objectContaining({ statusCode: 401 })
      );
    });

    it('verifyRefreshToken should throw ApiError 401 when token is invalid', () => {
      expect(() => tokenService.verifyRefreshToken('invalid.refresh.token')).toThrow(ApiError);
      expect(() => tokenService.verifyRefreshToken('invalid.refresh.token')).toThrow(
        expect.objectContaining({ statusCode: 401 })
      );
    });
  });

  describe('rotateRefreshToken', () => {
    it('should successfully rotate token: invalidate old in Redis and issue new token pair', async () => {
      const { refreshToken } = await tokenService.generateRefreshToken(mockUser);
      const userSpy = jest.spyOn(User, 'findByPk').mockResolvedValue(mockUser);

      const result = await tokenService.rotateRefreshToken(refreshToken);

      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.refreshToken).not.toBe(refreshToken);
      expect(result.user.email).toBe(mockUser.email);

      userSpy.mockRestore();
    });

    it('should reject reuse of an already rotated or invalidated token (token theft detection)', async () => {
      const { refreshToken } = await tokenService.generateRefreshToken(mockUser);
      const userSpy = jest.spyOn(User, 'findByPk').mockResolvedValue(mockUser);

      // First rotation succeeds
      await tokenService.rotateRefreshToken(refreshToken);

      // Second attempt with the SAME old token MUST fail with 401
      await expect(tokenService.rotateRefreshToken(refreshToken)).rejects.toThrow(ApiError);
      await expect(tokenService.rotateRefreshToken(refreshToken)).rejects.toMatchObject({
        statusCode: 401,
        message: 'Invalid or already rotated refresh token',
      });

      userSpy.mockRestore();
    });
  });

  describe('revokeRefreshToken', () => {
    it('should remove the refresh token key from Redis', async () => {
      const { refreshToken, tokenId } = await tokenService.generateRefreshToken(mockUser);
      const delSpy = jest.spyOn(redisClient, 'del');

      const revoked = await tokenService.revokeRefreshToken(refreshToken);
      expect(revoked).toBe(true);
      expect(delSpy).toHaveBeenCalledWith(`refresh_token:${mockUser.id}:${tokenId}`);

      delSpy.mockRestore();
    });
  });
});
