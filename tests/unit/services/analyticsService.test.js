const analyticsService = require('../../../src/services/analytics.service');

describe('Unit: AnalyticsService & Financial Aggregations (STORM-036)', () => {
  describe('calculateGrossRevenue', () => {
    it('should return 0 when items array is empty or undefined', () => {
      expect(analyticsService.calculateGrossRevenue([])).toBe(0);
      expect(analyticsService.calculateGrossRevenue(null)).toBe(0);
      expect(analyticsService.calculateGrossRevenue(undefined)).toBe(0);
    });

    it('should calculate gross revenue by summing item total_price attributes in LKR', () => {
      const items = [
        { total_price: '5500.00', quantity: 1 },
        { total_price: 3200.5, quantity: 1 },
        { total_price: 1800, quantity: 2 },
      ];
      // 5500 + 3200.50 + 1800 = 10500.50
      const revenue = analyticsService.calculateGrossRevenue(items);
      expect(revenue).toBe(10500.5);
    });

    it('should fallback to unit_price_at_purchase * quantity if total_price is null', () => {
      const items = [
        { unit_price_at_purchase: 4500, quantity: 2 },
        { unit_price_at_purchase: '2500.25', quantity: 3 },
      ];
      // (4500 * 2) + (2500.25 * 3) = 9000 + 7500.75 = 16500.75
      const revenue = analyticsService.calculateGrossRevenue(items);
      expect(revenue).toBe(16500.75);
    });

    it('should gracefully handle malformed or NaN numeric entries', () => {
      const items = [
        { total_price: 'invalid_num' },
        { unit_price_at_purchase: null, quantity: null },
        { total_price: 2500 },
      ];
      expect(analyticsService.calculateGrossRevenue(items)).toBe(2500);
    });
  });

  describe('formatLKR', () => {
    it('should format numbers into standard LKR currency strings', () => {
      expect(analyticsService.formatLKR(145000)).toBe('LKR 145,000.00');
      expect(analyticsService.formatLKR(2950.5)).toBe('LKR 2,950.50');
      expect(analyticsService.formatLKR(0)).toBe('LKR 0.00');
      expect(analyticsService.formatLKR('invalid')).toBe('LKR 0.00');
    });
  });

  describe('getOverviewMetrics contract structure', () => {
    it('should return a structured object with mandatory business metric keys', async () => {
      const metrics = await analyticsService.getOverviewMetrics();
      expect(metrics).toHaveProperty('totalRevenue');
      expect(metrics).toHaveProperty('totalRevenueRaw');
      expect(metrics).toHaveProperty('totalOrders');
      expect(metrics).toHaveProperty('todaysOrders');
      expect(metrics).toHaveProperty('activeCustomers');
      expect(metrics).toHaveProperty('lowStockItems');
      expect(metrics).toHaveProperty('currency', 'LKR');
      expect(typeof metrics.totalRevenue).toBe('string');
      expect(typeof metrics.totalRevenueRaw).toBe('number');
    });
  });

  describe('getSalesTrend window calculation', () => {
    it('should return chronological day buckets for the specified days window', async () => {
      const trendData = await analyticsService.getSalesTrend(7);
      expect(trendData).toHaveProperty('days', 7);
      expect(trendData).toHaveProperty('trend');
      expect(Array.isArray(trendData.trend)).toBe(true);
      expect(trendData.trend).toHaveLength(7);
      expect(trendData.trend[0]).toHaveProperty('date');
      expect(trendData.trend[0]).toHaveProperty('revenue');
      expect(trendData.trend[0]).toHaveProperty('orders');
    });

    it('should default to 30 days if parameter is not supplied', async () => {
      const trendData = await analyticsService.getSalesTrend();
      expect(trendData.days).toBe(30);
      expect(trendData.trend).toHaveLength(30);
    });
  });
});
