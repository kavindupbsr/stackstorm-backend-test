const { User, CustomerProfile, Address } = require('../../../src/models');

describe('User Model Unit Tests (Shift-Left Validation)', () => {
  it('should instantiate a valid user instance with default values', () => {
    const user = User.build({
      email: 'customer@dickwella-fashion.lk',
      password_hash: '$2b$10$hashedpasswordexample1234567890',
    });

    expect(user.email).toBe('customer@dickwella-fashion.lk');
    expect(user.role).toBe('customer');
    expect(user.is_active).toBe(true);
    expect(user.failed_login_attempts).toBe(0);
    expect(user.id).toBeDefined();
  });

  it('should normalize email to lowercase and trim spaces on validate', async () => {
    const user = User.build({
      email: '  TEST.USER@DICKWELLA-FASHION.LK  ',
      password_hash: '$2b$10$hashedpasswordexample1234567890',
    });

    await user.validate();
    expect(user.email).toBe('test.user@dickwella-fashion.lk');
  });

  it('should reject invalid email format', async () => {
    const user = User.build({
      email: 'invalid-email-string',
      password_hash: '$2b$10$hashedpasswordexample1234567890',
    });

    await expect(user.validate()).rejects.toThrow();
  });

  it('should reject missing email', async () => {
    const user = User.build({
      password_hash: '$2b$10$hashedpasswordexample1234567890',
    });

    await expect(user.validate()).rejects.toThrow();
  });

  it('should reject missing password_hash', async () => {
    const user = User.build({
      email: 'customer@dickwella-fashion.lk',
    });

    await expect(user.validate()).rejects.toThrow();
  });

  it('should reject invalid role ENUM values', async () => {
    const user = User.build({
      email: 'staff@dickwella-fashion.lk',
      password_hash: '$2b$10$hashedpasswordexample1234567890',
      role: 'super_admin_unauthorized',
    });

    await expect(user.validate()).rejects.toThrow();
  });

  it('should accept valid role ENUM values', async () => {
    const validRoles = ['customer', 'admin', 'inventory_staff', 'support_agent'];

    for (const role of validRoles) {
      const user = User.build({
        email: `${role}@dickwella-fashion.lk`,
        password_hash: '$2b$10$hashedpasswordexample1234567890',
        role,
      });

      // eslint-disable-next-line no-await-in-loop
      const validationError = await user.validate().catch((err) => err);
      expect(validationError).not.toBeInstanceOf(Error);
    }
  });

  it('should exclude password_hash from defaultScope', () => {
    const { defaultScope } = User.options;
    expect(defaultScope).toBeDefined();
    expect(defaultScope.attributes.exclude).toContain('password_hash');
  });

  it('should define correct associations with CustomerProfile and Address', () => {
    expect(User.associations.customerProfile).toBeDefined();
    expect(User.associations.customerProfile.target).toBe(CustomerProfile);
    expect(User.associations.customerProfile.foreignKey).toBe('user_id');

    expect(User.associations.addresses).toBeDefined();
    expect(User.associations.addresses.target).toBe(Address);
    expect(User.associations.addresses.foreignKey).toBe('user_id');
  });
});
