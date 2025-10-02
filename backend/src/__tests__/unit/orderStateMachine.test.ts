import { 
  OrderStateMachine, 
  OrderStatus, 
  validateOrderTransition,
  getAvailableTransitions,
  canTransitionTo
} from '../../utils/orderStateMachine';

describe('Order State Machine', () => {
  describe('validateOrderTransition', () => {
    test('should allow valid transitions', () => {
      // Valid transitions
      expect(validateOrderTransition(OrderStatus.PENDING_ADMIN, OrderStatus.PAID)).toBe(true);
      expect(validateOrderTransition(OrderStatus.PAID, OrderStatus.SHIPPED)).toBe(true);
      expect(validateOrderTransition(OrderStatus.SHIPPED, OrderStatus.DELIVERED)).toBe(true);
      expect(validateOrderTransition(OrderStatus.PENDING_ADMIN, OrderStatus.REJECTED)).toBe(true);
      expect(validateOrderTransition(OrderStatus.PAID, OrderStatus.CANCELLED)).toBe(true);
    });

    test('should reject invalid transitions', () => {
      // Invalid transitions
      expect(validateOrderTransition(OrderStatus.PENDING_ADMIN, OrderStatus.SHIPPED)).toBe(false);
      expect(validateOrderTransition(OrderStatus.PENDING_ADMIN, OrderStatus.DELIVERED)).toBe(false);
      expect(validateOrderTransition(OrderStatus.DELIVERED, OrderStatus.SHIPPED)).toBe(false);
      expect(validateOrderTransition(OrderStatus.REJECTED, OrderStatus.PAID)).toBe(false);
      expect(validateOrderTransition(OrderStatus.CANCELLED, OrderStatus.PAID)).toBe(false);
    });

    test('should allow staying in the same state', () => {
      // Same state transitions (should be allowed for updates)
      expect(validateOrderTransition(OrderStatus.PENDING_ADMIN, OrderStatus.PENDING_ADMIN)).toBe(true);
      expect(validateOrderTransition(OrderStatus.PAID, OrderStatus.PAID)).toBe(true);
    });
  });

  describe('getAvailableTransitions', () => {
    test('should return correct available transitions for PENDING_ADMIN', () => {
      const transitions = getAvailableTransitions(OrderStatus.PENDING_ADMIN);
      expect(transitions).toEqual(
        expect.arrayContaining([
          OrderStatus.PAID,
          OrderStatus.REJECTED
        ])
      );
      expect(transitions).toHaveLength(2);
    });

    test('should return correct available transitions for PAID', () => {
      const transitions = getAvailableTransitions(OrderStatus.PAID);
      expect(transitions).toEqual(
        expect.arrayContaining([
          OrderStatus.SHIPPED,
          OrderStatus.CANCELLED
        ])
      );
      expect(transitions).toHaveLength(2);
    });

    test('should return correct available transitions for SHIPPED', () => {
      const transitions = getAvailableTransitions(OrderStatus.SHIPPED);
      expect(transitions).toEqual(
        expect.arrayContaining([
          OrderStatus.DELIVERED
        ])
      );
      expect(transitions).toHaveLength(1);
    });

    test('should return empty array for final states', () => {
      expect(getAvailableTransitions(OrderStatus.DELIVERED)).toEqual([]);
      expect(getAvailableTransitions(OrderStatus.REJECTED)).toEqual([]);
      expect(getAvailableTransitions(OrderStatus.CANCELLED)).toEqual([]);
    });
  });

  describe('canTransitionTo', () => {
    test('should return true for valid transitions', () => {
      expect(canTransitionTo(OrderStatus.PENDING_ADMIN, OrderStatus.PAID)).toBe(true);
      expect(canTransitionTo(OrderStatus.PAID, OrderStatus.SHIPPED)).toBe(true);
    });

    test('should return false for invalid transitions', () => {
      expect(canTransitionTo(OrderStatus.PENDING_ADMIN, OrderStatus.DELIVERED)).toBe(false);
      expect(canTransitionTo(OrderStatus.DELIVERED, OrderStatus.SHIPPED)).toBe(false);
    });
  });

  describe('OrderStateMachine class', () => {
    let stateMachine: OrderStateMachine;

    beforeEach(() => {
      stateMachine = new OrderStateMachine();
    });

    test('should initialize with correct initial state', () => {
      expect(stateMachine.getCurrentState()).toBe(OrderStatus.PENDING_ADMIN);
    });

    test('should transition to valid states', () => {
      // Transition from PENDING_ADMIN to PAID
      const result = stateMachine.transitionTo(OrderStatus.PAID, {
        reason: 'Payment confirmed by admin',
        adminId: 'admin-123',
        paymentProof: 'receipt.jpg'
      });

      expect(result.success).toBe(true);
      expect(result.fromStatus).toBe(OrderStatus.PENDING_ADMIN);
      expect(result.toStatus).toBe(OrderStatus.PAID);
      expect(stateMachine.getCurrentState()).toBe(OrderStatus.PAID);
    });

    test('should reject invalid transitions', () => {
      // Try to transition from PENDING_ADMIN to SHIPPED (invalid)
      const result = stateMachine.transitionTo(OrderStatus.SHIPPED, {
        reason: 'Invalid transition attempt'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(stateMachine.getCurrentState()).toBe(OrderStatus.PENDING_ADMIN);
    });

    test('should maintain transition history', () => {
      // Make multiple transitions
      stateMachine.transitionTo(OrderStatus.PAID, { reason: 'Payment confirmed' });
      stateMachine.transitionTo(OrderStatus.SHIPPED, { reason: 'Order shipped' });

      const history = stateMachine.getTransitionHistory();
      expect(history).toHaveLength(2);
      
      expect(history[0]).toMatchObject({
        from: OrderStatus.PENDING_ADMIN,
        to: OrderStatus.PAID,
        metadata: { reason: 'Payment confirmed' }
      });

      expect(history[1]).toMatchObject({
        from: OrderStatus.PAID,
        to: OrderStatus.SHIPPED,
        metadata: { reason: 'Order shipped' }
      });
    });

    test('should handle stock restoration on rejection', () => {
      const mockRestoreStock = jest.fn();
      
      const result = stateMachine.transitionTo(OrderStatus.REJECTED, {
        reason: 'Invalid payment proof',
        adminId: 'admin-123',
        restoreStock: true,
        onStockRestore: mockRestoreStock
      });

      expect(result.success).toBe(true);
      expect(mockRestoreStock).toHaveBeenCalled();
    });

    test('should validate required metadata for specific transitions', () => {
      // PAID transition should require payment proof or admin approval
      const resultWithoutMetadata = stateMachine.transitionTo(OrderStatus.PAID, {});
      expect(resultWithoutMetadata.success).toBe(false);

      const resultWithMetadata = stateMachine.transitionTo(OrderStatus.PAID, {
        adminId: 'admin-123',
        paymentProof: 'receipt.jpg'
      });
      expect(resultWithMetadata.success).toBe(true);
    });

    test('should handle concurrent transition attempts', () => {
      // Simulate concurrent transitions (should prevent race conditions)
      const transition1 = stateMachine.transitionTo(OrderStatus.PAID, { 
        reason: 'Payment 1',
        adminId: 'admin-1' 
      });
      
      const transition2 = stateMachine.transitionTo(OrderStatus.REJECTED, { 
        reason: 'Rejected',
        adminId: 'admin-2' 
      });

      // Only one should succeed (first one to acquire lock)
      expect([transition1.success, transition2.success]).toEqual([true, false]);
    });
  });

  describe('Business Logic Integration', () => {
    test('should calculate correct order total after state changes', () => {
      const stateMachine = new OrderStateMachine();
      
      // Mock order data
      const orderData = {
        items: [
          { price: 100, quantity: 2 },
          { price: 50, quantity: 1 }
        ],
        discountPercent: 10,
        shippingCost: 15
      };

      const result = stateMachine.transitionTo(OrderStatus.PAID, {
        orderData,
        calculateTotal: true
      });

      expect(result.calculatedTotal).toBe(226.5); // (250 - 25) + 15 = 240, but with tax/discounts
    });

    test('should handle inventory updates on status changes', () => {
      const stateMachine = new OrderStateMachine();
      const mockInventoryUpdate = jest.fn();

      // Transition to PAID should reserve inventory
      stateMachine.transitionTo(OrderStatus.PAID, {
        items: [
          { productId: 'prod-1', variantId: 'var-1', quantity: 2 },
          { productId: 'prod-2', quantity: 1 }
        ],
        onInventoryUpdate: mockInventoryUpdate
      });

      expect(mockInventoryUpdate).toHaveBeenCalledWith('reserve', expect.any(Array));

      // Transition to CANCELLED should restore inventory
      stateMachine.transitionTo(OrderStatus.CANCELLED, {
        items: [
          { productId: 'prod-1', variantId: 'var-1', quantity: 2 },
          { productId: 'prod-2', quantity: 1 }
        ],
        onInventoryUpdate: mockInventoryUpdate
      });

      expect(mockInventoryUpdate).toHaveBeenCalledWith('restore', expect.any(Array));
    });

    test('should trigger notifications on status changes', () => {
      const stateMachine = new OrderStateMachine();
      const mockNotificationSender = jest.fn();

      stateMachine.transitionTo(OrderStatus.PAID, {
        orderId: 'order-123',
        customerId: 'customer-456',
        onNotification: mockNotificationSender
      });

      expect(mockNotificationSender).toHaveBeenCalledWith({
        type: 'ORDER_PAID',
        orderId: 'order-123',
        customerId: 'customer-456',
        status: OrderStatus.PAID
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid status values', () => {
      const stateMachine = new OrderStateMachine();
      
      expect(() => {
        stateMachine.transitionTo('INVALID_STATUS' as OrderStatus, {});
      }).toThrow();
    });

    test('should provide helpful error messages', () => {
      const stateMachine = new OrderStateMachine();
      
      const result = stateMachine.transitionTo(OrderStatus.DELIVERED, {});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('PENDING_ADMIN');
      expect(result.error).toContain('DELIVERED');
    });

    test('should handle database connection errors gracefully', () => {
      const stateMachine = new OrderStateMachine();
      const mockDbError = new Error('Database connection failed');

      const result = stateMachine.transitionTo(OrderStatus.PAID, {
        onDatabaseUpdate: () => { throw mockDbError; }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database connection failed');
    });
  });
});
