const { Address, CustomerProfile, User } = require('../../../src/models');

describe('Address & CustomerProfile Models Unit Tests (Shift-Left Validation)', () => {
  describe('Address Model', () => {
    it('should build a valid address instance with default values', () => {
      const address = Address.build({
        user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        address_line1: '123 Main Street',
        address_line2: 'Apt 4B',
        city: 'Dickwella',
        postal_code: '82400',
      });

      expect(address.address_line1).toBe('123 Main Street');
      expect(address.address_line2).toBe('Apt 4B');
      expect(address.city).toBe('Dickwella');
      expect(address.postal_code).toBe('82400');
      expect(address.is_default).toBe(false);
      expect(address.id).toBeDefined();
    });

    it('should reject missing address_line1', async () => {
      const address = Address.build({
        user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        city: 'Dickwella',
        postal_code: '82400',
      });

      await expect(address.validate()).rejects.toThrow();
    });

    it('should reject missing city', async () => {
      const address = Address.build({
        user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        address_line1: '123 Main Street',
        postal_code: '82400',
      });

      await expect(address.validate()).rejects.toThrow();
    });

    it('should reject missing postal_code', async () => {
      const address = Address.build({
        user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        address_line1: '123 Main Street',
        city: 'Dickwella',
      });

      await expect(address.validate()).rejects.toThrow();
    });

    it('should define belongsTo User association', () => {
      expect(Address.associations.user).toBeDefined();
      expect(Address.associations.user.target).toBe(User);
      expect(Address.associations.user.foreignKey).toBe('user_id');
    });
  });

  describe('CustomerProfile Model', () => {
    it('should build a valid customer profile with default loyalty_tier silver', () => {
      const profile = CustomerProfile.build({
        user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        phone: '+94771234567',
      });

      expect(profile.loyalty_tier).toBe('silver');
      expect(profile.marketing_opt_in).toBe(false);
      expect(profile.id).toBeDefined();
    });

    it('should accept valid loyalty tiers', async () => {
      const tiers = ['silver', 'gold', 'platinum'];

      for (const tier of tiers) {
        const profile = CustomerProfile.build({
          user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          loyalty_tier: tier,
        });

        // eslint-disable-next-line no-await-in-loop
        const validationError = await profile.validate().catch((err) => err);
        expect(validationError).not.toBeInstanceOf(Error);
      }
    });

    it('should reject invalid loyalty tier', async () => {
      const profile = CustomerProfile.build({
        user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        loyalty_tier: 'diamond_invalid',
      });

      await expect(profile.validate()).rejects.toThrow();
    });

    it('should define belongsTo User association', () => {
      expect(CustomerProfile.associations.user).toBeDefined();
      expect(CustomerProfile.associations.user.target).toBe(User);
      expect(CustomerProfile.associations.user.foreignKey).toBe('user_id');
    });
  });
});
