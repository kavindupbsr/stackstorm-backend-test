const userService = require('../../../src/services/user.service');
const { Address, sequelize } = require('../../../src/models');
const redisClient = require('../../../src/config/redis');

describe('Unit: User & Address Service (STORM-032)', () => {
  const testUserId = 'b0000000-0000-0000-0000-000000000005'; // lakshani@example.lk
  const otherUserId = 'b0000000-0000-0000-0000-000000000004'; // thanoo@example.lk
  let addr1;
  let addr2;

  beforeAll(async () => {
    try {
      await Address.destroy({ where: { user_id: [testUserId, otherUserId] } });
    } catch {
      // Offline fallback
    }
  });

  afterAll(async () => {
    try {
      await Address.destroy({ where: { user_id: [testUserId, otherUserId] } });
      await sequelize.close();
      await redisClient.quit();
    } catch {
      // Offline fallback
    }
  });

  describe('Phone Validation Utility', () => {
    it('should accept valid international and domestic phone formats', () => {
      expect(userService.isValidPhone('+94771234567')).toBe(true);
      expect(userService.isValidPhone('0771234567')).toBe(true);
      expect(userService.isValidPhone('+1 555-123-4567')).toBe(true);
    });

    it('should reject invalid phone formats', () => {
      expect(userService.isValidPhone('123')).toBe(false);
      expect(userService.isValidPhone('abc-def-ghij')).toBe(false);
      expect(userService.isValidPhone('')).toBe(false);
      expect(userService.isValidPhone(null)).toBe(false);
    });
  });

  describe('Address Management & Atomic Default Toggle', () => {
    it('should create initial address and set is_default to true', async () => {
      addr1 = await userService.addAddress(testUserId, {
        address_line1: '12 Temple Road',
        city: 'Dickwella',
        postal_code: '81100',
      });

      expect(addr1.id).toBeDefined();
      expect(addr1.is_default).toBe(true);
    });

    it('should create second address with is_default=true and clear is_default from first address', async () => {
      addr2 = await userService.addAddress(testUserId, {
        address_line1: '99 High Street',
        city: 'Matara',
        postal_code: '81000',
        is_default: true,
      });

      expect(addr2.id).toBeDefined();
      expect(addr2.is_default).toBe(true);

      const refreshedAddr1 = await Address.findByPk(addr1.id);
      expect(refreshedAddr1.is_default).toBe(false);
    });

    it('should enforce IDOR prevention: cannot delete address owned by another user', async () => {
      await expect(userService.deleteAddress(otherUserId, addr1.id)).rejects.toThrow(
        /does not belong to user/i
      );
    });

    it('should promote remaining address to default when default address is deleted', async () => {
      // Delete addr2 (current default)
      const res = await userService.deleteAddress(testUserId, addr2.id);
      expect(res.deleted).toBe(true);

      // Verify addr1 was promoted to default
      const remaining = await Address.findByPk(addr1.id);
      expect(remaining.is_default).toBe(true);
    });
  });

  describe('Profile Operations', () => {
    it('should retrieve structured profile with loyalty details', async () => {
      const profile = await userService.getProfile(testUserId);
      expect(profile.id).toBe(testUserId);
      expect(profile.email).toBe('lakshani@example.lk');
      expect(profile.loyalty_tier).toBeDefined();
      expect(Array.isArray(profile.addresses)).toBe(true);
    });

    it('should update profile contact details', async () => {
      const updated = await userService.updateProfile(testUserId, {
        phone: '+94719876543',
        marketing_opt_in: true,
      });

      expect(updated.phone).toBe('+94719876543');
      expect(updated.marketing_opt_in).toBe(true);
    });
  });
});
