const bcrypt = require('bcryptjs');

// Precomputed bcrypt hash (rounds 12) for 'Password123!'
// Also dynamic hash generation fallback
const DEFAULT_PASSWORD = 'Password123!';
const PASSWORD_HASH = bcrypt.hashSync(DEFAULT_PASSWORD, 12);

const users = [
  {
    id: 'b0000000-0000-0000-0000-000000000001',
    email: 'admin@dickwellafashion.lk',
    password_hash: PASSWORD_HASH,
    role: 'admin',
    phone_number: '+94412255001',
    is_active: true,
    is_email_verified: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 'b0000000-0000-0000-0000-000000000002',
    email: 'inventory@dickwellafashion.lk',
    password_hash: PASSWORD_HASH,
    role: 'inventory_staff',
    phone_number: '+94412255002',
    is_active: true,
    is_email_verified: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 'b0000000-0000-0000-0000-000000000003',
    email: 'pabasara@example.lk',
    password_hash: PASSWORD_HASH,
    role: 'customer',
    phone_number: '+94771234001',
    is_active: true,
    is_email_verified: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 'b0000000-0000-0000-0000-000000000004',
    email: 'thanoo@example.lk',
    password_hash: PASSWORD_HASH,
    role: 'customer',
    phone_number: '+94771234002',
    is_active: true,
    is_email_verified: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 'b0000000-0000-0000-0000-000000000005',
    email: 'lakshani@example.lk',
    password_hash: PASSWORD_HASH,
    role: 'customer',
    phone_number: '+94771234003',
    is_active: true,
    is_email_verified: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 'b0000000-0000-0000-0000-000000000006',
    email: 'ruwan@example.lk',
    password_hash: PASSWORD_HASH,
    role: 'customer',
    phone_number: '+94771234004',
    is_active: true,
    is_email_verified: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 'b0000000-0000-0000-0000-000000000007',
    email: 'kamal.perera@example.lk',
    password_hash: PASSWORD_HASH,
    role: 'customer',
    phone_number: '+94771234005',
    is_active: true,
    is_email_verified: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
];

const customerProfiles = [
  {
    id: 'b1000000-0000-0000-0000-000000000001',
    user_id: 'b0000000-0000-0000-0000-000000000001',
    first_name: 'Super',
    last_name: 'Admin',
    avatar_url:
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&q=80',
    date_of_birth: '1988-03-15',
    loyalty_tier: 'platinum',
    loyalty_points: 5000,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 'b1000000-0000-0000-0000-000000000002',
    user_id: 'b0000000-0000-0000-0000-000000000002',
    first_name: 'Inventory',
    last_name: 'Manager',
    avatar_url:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    date_of_birth: '1992-07-22',
    loyalty_tier: 'gold',
    loyalty_points: 2000,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 'b1000000-0000-0000-0000-000000000003',
    user_id: 'b0000000-0000-0000-0000-000000000003',
    first_name: 'Pabasara',
    last_name: 'B.K.',
    avatar_url:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    date_of_birth: '1999-11-10',
    loyalty_tier: 'gold',
    loyalty_points: 1540,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 'b1000000-0000-0000-0000-000000000004',
    user_id: 'b0000000-0000-0000-0000-000000000004',
    first_name: 'Thanoogithan',
    last_name: 'S.',
    avatar_url:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    date_of_birth: '2000-04-18',
    loyalty_tier: 'silver',
    loyalty_points: 820,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 'b1000000-0000-0000-0000-000000000005',
    user_id: 'b0000000-0000-0000-0000-000000000005',
    first_name: 'Lakshani',
    last_name: 'A.T.',
    avatar_url:
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
    date_of_birth: '2001-08-05',
    loyalty_tier: 'bronze',
    loyalty_points: 340,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 'b1000000-0000-0000-0000-000000000006',
    user_id: 'b0000000-0000-0000-0000-000000000006',
    first_name: 'Ruwan',
    last_name: 'Amarawickrama',
    avatar_url:
      'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80',
    date_of_birth: '1998-01-30',
    loyalty_tier: 'platinum',
    loyalty_points: 4200,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 'b1000000-0000-0000-0000-000000000007',
    user_id: 'b0000000-0000-0000-0000-000000000007',
    first_name: 'Kamal',
    last_name: 'Perera',
    avatar_url:
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80',
    date_of_birth: '1995-12-14',
    loyalty_tier: 'silver',
    loyalty_points: 650,
    created_at: new Date(),
    updated_at: new Date(),
  },
];

const addresses = [
  {
    id: 'b2000000-0000-0000-0000-000000000001',
    user_id: 'b0000000-0000-0000-0000-000000000003',
    recipient_name: 'Pabasara B.K.',
    phone_number: '+94771234001',
    street_address: '42 Beach Road',
    city: 'Matara',
    postal_code: '81000',
    country: 'Sri Lanka',
    is_default: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 'b2000000-0000-0000-0000-000000000002',
    user_id: 'b0000000-0000-0000-0000-000000000004',
    recipient_name: 'S. Thanoogithan',
    phone_number: '+94771234002',
    street_address: '15 Galle Road, Wellawatte',
    city: 'Colombo',
    postal_code: '00600',
    country: 'Sri Lanka',
    is_default: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 'b2000000-0000-0000-0000-000000000003',
    user_id: 'b0000000-0000-0000-0000-000000000005',
    recipient_name: 'Lakshani A.T.',
    phone_number: '+94771234003',
    street_address: '88 Peradeniya Road',
    city: 'Kandy',
    postal_code: '20000',
    country: 'Sri Lanka',
    is_default: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 'b2000000-0000-0000-0000-000000000004',
    user_id: 'b0000000-0000-0000-0000-000000000006',
    recipient_name: 'Ruwan Amarawickrama',
    phone_number: '+94771234004',
    street_address: '104 Fort Promenade',
    city: 'Galle',
    postal_code: '80000',
    country: 'Sri Lanka',
    is_default: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 'b2000000-0000-0000-0000-000000000005',
    user_id: 'b0000000-0000-0000-0000-000000000007',
    recipient_name: 'Kamal Perera',
    phone_number: '+94771234005',
    street_address: '12 Main Street, Market Junction',
    city: 'Dickwella',
    postal_code: '81180',
    country: 'Sri Lanka',
    is_default: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
];

const loyaltyAccounts = [
  {
    customer_id: 'b0000000-0000-0000-0000-000000000003',
    points_balance: 1540,
    tier: 'gold',
    lifetime_spend: 78500.0,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    customer_id: 'b0000000-0000-0000-0000-000000000004',
    points_balance: 820,
    tier: 'silver',
    lifetime_spend: 34200.0,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    customer_id: 'b0000000-0000-0000-0000-000000000005',
    points_balance: 340,
    tier: 'bronze',
    lifetime_spend: 14500.0,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    customer_id: 'b0000000-0000-0000-0000-000000000006',
    points_balance: 4200,
    tier: 'platinum',
    lifetime_spend: 215000.0,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    customer_id: 'b0000000-0000-0000-0000-000000000007',
    points_balance: 650,
    tier: 'silver',
    lifetime_spend: 28900.0,
    created_at: new Date(),
    updated_at: new Date(),
  },
];

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.bulkInsert('users', users, {});
    await queryInterface.bulkInsert('customer_profiles', customerProfiles, {});
    await queryInterface.bulkInsert('addresses', addresses, {});
    await queryInterface.bulkInsert('loyalty_accounts', loyaltyAccounts, {});
  },

  down: async (queryInterface) => {
    const userIds = users.map((u) => u.id);
    await queryInterface.bulkDelete('loyalty_accounts', { customer_id: userIds }, {});
    await queryInterface.bulkDelete('addresses', { user_id: userIds }, {});
    await queryInterface.bulkDelete('customer_profiles', { user_id: userIds }, {});
    await queryInterface.bulkDelete('users', { id: userIds }, {});
  },

  users,
  customerProfiles,
  addresses,
  loyaltyAccounts,
  DEFAULT_PASSWORD,
};
