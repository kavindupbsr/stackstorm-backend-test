const stripeService = require('../../../src/services/stripe.service');

describe('Unit: Stripe Service & Cryptographic Verification (STORM-028)', () => {
  const sampleOrderId = 'e0000000-0000-0000-0000-000000000001';

  describe('createPaymentIntent', () => {
    it('should throw badRequest ApiError if orderId is missing', async () => {
      await expect(stripeService.createPaymentIntent(null)).rejects.toThrow(
        /order_id is required/i
      );
    });

    it('should generate PaymentIntent with clientSecret and LKR amount', async () => {
      const intent = await stripeService.createPaymentIntent(sampleOrderId);

      expect(intent).toBeDefined();
      expect(intent.clientSecret).toBeDefined();
      expect(intent.paymentIntentId).toBeDefined();
      expect(intent.currency).toBe('LKR');
      expect(intent.orderId).toBe(sampleOrderId);
    });
  });

  describe('constructWebhookEvent Signature Verification', () => {
    it('should throw badRequest if signature header is missing', () => {
      expect(() => stripeService.constructWebhookEvent(Buffer.from('{}'), null)).toThrow(
        /missing stripe-signature/i
      );
    });

    it('should throw badRequest if payload is missing', () => {
      expect(() => stripeService.constructWebhookEvent(null, 't=1,v1=sig')).toThrow(
        /missing raw webhook payload/i
      );
    });

    it('should throw badRequest for forged or tampered signatures', () => {
      const forgedSig = 't=1600000000,v1=bad_hash_signature_00000000000000000000000000';
      const payload = Buffer.from(JSON.stringify({ type: 'payment_intent.succeeded' }));

      expect(() => stripeService.constructWebhookEvent(payload, forgedSig)).toThrow(
        /webhook signature verification failed/i
      );
    });

    it('should successfully construct and verify event when signature is authentic', () => {
      const mockEvent = {
        id: 'evt_authentic_001',
        object: 'event',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_valid',
            amount: 500000,
            currency: 'lkr',
          },
        },
      };

      const { rawPayload, signature } = stripeService.generateTestWebhookPayload(mockEvent);
      const verifiedEvent = stripeService.constructWebhookEvent(rawPayload, signature);

      expect(verifiedEvent).toBeDefined();
      expect(verifiedEvent.id).toBe('evt_authentic_001');
      expect(verifiedEvent.type).toBe('payment_intent.succeeded');
    });
  });

  describe('handleWebhookEvent Edge Cases', () => {
    it('should reject invalid event structure with badRequest', async () => {
      await expect(stripeService.handleWebhookEvent(null)).rejects.toThrow(
        /invalid stripe webhook event/i
      );
    });

    it('should handle unhandled event types gracefully without throwing errors', async () => {
      const res = await stripeService.handleWebhookEvent({
        id: 'evt_other',
        type: 'customer.created',
        data: {},
      });

      expect(res.success).toBe(true);
      expect(res.processed).toBe(false);
    });
  });
});
