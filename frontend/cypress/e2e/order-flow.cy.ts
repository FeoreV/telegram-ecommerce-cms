describe('Order Management Flow', () => {
  beforeEach(() => {
    // Mock authentication
    cy.window().then((win) => {
      win.localStorage.setItem('accessToken', 'mock-admin-token');
    });

    // Intercept API calls
    cy.intercept('GET', '/api/auth/profile', {
      fixture: 'admin-user.json'
    }).as('getProfile');

    cy.intercept('GET', '/api/orders*', {
      fixture: 'orders-list.json'
    }).as('getOrders');

    cy.intercept('PUT', '/api/orders/*/confirm', {
      statusCode: 200,
      body: { success: true, order: { id: 'order-123', status: 'PAID' } }
    }).as('confirmPayment');

    cy.intercept('PUT', '/api/orders/*/reject', {
      statusCode: 200,
      body: { success: true, order: { id: 'order-123', status: 'REJECTED' } }
    }).as('rejectPayment');
  });

  describe('Payment Verification Screen', () => {
    it('should display orders awaiting verification', () => {
      cy.visit('/orders');
      cy.wait('@getProfile');
      cy.wait('@getOrders');

      // Navigate to verification tab
      cy.get('[data-testid="verification-tab"]').click();

      // Should show orders with PENDING_ADMIN status
      cy.get('[data-testid="order-card"]').should('have.length.greaterThan', 0);
      cy.contains('Ожидает проверки').should('be.visible');
    });

    it('should show payment proof when available', () => {
      cy.visit('/orders');
      cy.get('[data-testid="verification-tab"]').click();

      // Click on order with payment proof
      cy.get('[data-testid="order-card"]').first().within(() => {
        cy.contains('Чек прикреплен').should('be.visible');
        cy.get('[data-testid="view-proof-button"]').click();
      });

      // Should open payment proof in new tab
      cy.window().then((win) => {
        cy.stub(win, 'open').as('windowOpen');
      });
      cy.get('@windowOpen').should('have.been.called');
    });

    it('should confirm payment successfully', () => {
      cy.visit('/orders');
      cy.get('[data-testid="verification-tab"]').click();

      // Click confirm on first order
      cy.get('[data-testid="order-card"]').first().within(() => {
        cy.get('[data-testid="confirm-button"]').click();
      });

      // Confirm in dialog
      cy.get('[data-testid="confirm-dialog"]').within(() => {
        cy.contains('Подтвердить оплату').should('be.visible');
        cy.get('[data-testid="confirm-payment-button"]').click();
      });

      cy.wait('@confirmPayment');

      // Should show success message
      cy.contains('Платеж подтвержден').should('be.visible');
    });

    it('should reject payment with reason', () => {
      cy.visit('/orders');
      cy.get('[data-testid="verification-tab"]').click();

      // Click reject on first order
      cy.get('[data-testid="order-card"]').first().within(() => {
        cy.get('[data-testid="reject-button"]').click();
      });

      // Fill rejection reason
      cy.get('[data-testid="reject-dialog"]').within(() => {
        cy.get('[data-testid="rejection-reason"]').type('Неверный чек об оплате');
        cy.get('[data-testid="confirm-reject-button"]').click();
      });

      cy.wait('@rejectPayment');

      // Should show success message
      cy.contains('Заказ отклонен').should('be.visible');
    });
  });

  describe('Order Filtering and Search', () => {
    it('should filter orders by status', () => {
      cy.visit('/orders');

      // Test different status filters
      const statuses = ['paid', 'shipped', 'delivered', 'rejected'];

      statuses.forEach(status => {
        cy.get(`[data-testid="${status}-tab"]`).click();
        cy.wait('@getOrders');
        
        // Should update URL with status filter
        cy.url().should('include', `status=${status.toUpperCase()}`);
      });
    });

    it('should search orders by order number', () => {
      cy.visit('/orders');

      // Enter search term
      cy.get('[data-testid="search-input"]').type('ORD-123');
      cy.get('[data-testid="search-button"]').click();

      cy.wait('@getOrders');

      // Should show filtered results
      cy.get('[data-testid="order-card"]').should('contain', 'ORD-123');
    });

    it('should use date range filter', () => {
      cy.visit('/orders');

      // Open filters
      cy.get('[data-testid="filters-button"]').click();

      // Set date range
      cy.get('[data-testid="date-from"]').type('2024-01-01');
      cy.get('[data-testid="date-to"]').type('2024-01-31');
      cy.get('[data-testid="apply-filters"]').click();

      cy.wait('@getOrders');

      // Should apply date filter
      cy.url().should('include', 'dateFrom=2024-01-01');
      cy.url().should('include', 'dateTo=2024-01-31');
    });
  });

  describe('Bulk Operations', () => {
    beforeEach(() => {
      cy.intercept('PUT', '/api/orders/bulk/confirm', {
        statusCode: 200,
        body: { success: true, confirmedCount: 3 }
      }).as('bulkConfirm');
    });

    it('should select multiple orders', () => {
      cy.visit('/orders');
      cy.get('[data-testid="verification-tab"]').click();

      // Enable bulk mode
      cy.get('[data-testid="bulk-mode-toggle"]').click();

      // Select multiple orders
      cy.get('[data-testid="order-checkbox"]').first().check();
      cy.get('[data-testid="order-checkbox"]').eq(1).check();
      cy.get('[data-testid="order-checkbox"]').eq(2).check();

      // Should show bulk actions
      cy.get('[data-testid="bulk-actions"]').should('be.visible');
      cy.contains('3 заказа выбрано').should('be.visible');
    });

    it('should perform bulk confirmation', () => {
      cy.visit('/orders');
      cy.get('[data-testid="verification-tab"]').click();
      cy.get('[data-testid="bulk-mode-toggle"]').click();

      // Select orders
      cy.get('[data-testid="order-checkbox"]').first().check();
      cy.get('[data-testid="order-checkbox"]').eq(1).check();

      // Perform bulk confirmation
      cy.get('[data-testid="bulk-confirm"]').click();

      // Confirm in dialog
      cy.get('[data-testid="bulk-confirm-dialog"]').within(() => {
        cy.contains('Подтвердить 2 заказа').should('be.visible');
        cy.get('[data-testid="confirm-bulk-action"]').click();
      });

      cy.wait('@bulkConfirm');

      // Should show success message
      cy.contains('3 заказа подтверждено').should('be.visible');
    });
  });

  describe('Real-time Updates', () => {
    it('should receive real-time order updates', () => {
      cy.visit('/orders');

      // Mock socket connection
      cy.window().then((win) => {
        // Simulate receiving real-time update
        const mockUpdate = {
          type: 'order:payment_confirmed',
          orderId: 'order-123',
          orderNumber: 'ORD-12345678',
          status: 'PAID'
        };

        // Trigger socket event
        win.dispatchEvent(new CustomEvent('socket:order_update', {
          detail: mockUpdate
        }));
      });

      // Should show notification
      cy.contains('Оплата заказа #12345678 подтверждена').should('be.visible');
    });

    it('should update order status in real-time', () => {
      cy.visit('/orders');
      cy.get('[data-testid="verification-tab"]').click();

      // Initial state
      cy.get('[data-testid="order-card"]').first().within(() => {
        cy.contains('Ожидает проверки').should('be.visible');
      });

      // Simulate real-time status change
      cy.window().then((win) => {
        win.dispatchEvent(new CustomEvent('socket:order_status_changed', {
          detail: {
            orderId: 'order-123',
            newStatus: 'PAID',
            orderNumber: 'ORD-12345678'
          }
        }));
      });

      // Should update status in UI
      cy.get('[data-testid="order-card"]').first().within(() => {
        cy.contains('Оплачен').should('be.visible');
      });
    });
  });

  describe('Order Details', () => {
    it('should show detailed order information', () => {
      cy.visit('/orders');

      // Click on order to view details
      cy.get('[data-testid="order-card"]').first().click();

      // Should open order details dialog
      cy.get('[data-testid="order-details-dialog"]').within(() => {
        cy.contains('Детали заказа').should('be.visible');
        cy.contains('Информация о клиенте').should('be.visible');
        cy.contains('Товары в заказе').should('be.visible');
        cy.contains('История изменений').should('be.visible');
      });
    });

    it('should display order timeline', () => {
      cy.visit('/orders');
      cy.get('[data-testid="order-card"]').first().click();

      cy.get('[data-testid="order-details-dialog"]').within(() => {
        cy.get('[data-testid="order-timeline"]').should('be.visible');
        cy.contains('Заказ создан').should('be.visible');
        cy.contains('Ожидает подтверждения').should('be.visible');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', () => {
      // Mock API error
      cy.intercept('PUT', '/api/orders/*/confirm', {
        statusCode: 500,
        body: { error: 'Internal server error' }
      }).as('confirmError');

      cy.visit('/orders');
      cy.get('[data-testid="verification-tab"]').click();

      // Try to confirm order
      cy.get('[data-testid="order-card"]').first().within(() => {
        cy.get('[data-testid="confirm-button"]').click();
      });

      cy.get('[data-testid="confirm-dialog"]').within(() => {
        cy.get('[data-testid="confirm-payment-button"]').click();
      });

      cy.wait('@confirmError');

      // Should show error message
      cy.contains('Ошибка при подтверждении заказа').should('be.visible');
    });

    it('should handle network connectivity issues', () => {
      cy.visit('/orders');

      // Simulate network failure
      cy.intercept('GET', '/api/orders*', { forceNetworkError: true }).as('networkError');

      // Refresh orders
      cy.get('[data-testid="refresh-button"]').click();
      cy.wait('@networkError');

      // Should show network error message
      cy.contains('Ошибка сети').should('be.visible');
    });
  });

  describe('Accessibility', () => {
    it('should be navigable with keyboard', () => {
      cy.visit('/orders');

      // Tab through the interface
      cy.get('body').tab();
      cy.focused().should('have.attr', 'data-testid', 'verification-tab');

      cy.focused().tab();
      cy.focused().should('have.attr', 'data-testid', 'all-tab');

      // Continue tabbing to order cards
      cy.get('[data-testid="order-card"]').first().within(() => {
        cy.get('[data-testid="confirm-button"]').focus();
        cy.focused().should('be.visible');
      });
    });

    it('should have proper ARIA labels', () => {
      cy.visit('/orders');

      // Check ARIA labels
      cy.get('[data-testid="verification-tab"]').should('have.attr', 'role', 'tab');
      cy.get('[data-testid="order-card"]').should('have.attr', 'role', 'article');
      cy.get('[data-testid="confirm-button"]').should('have.attr', 'aria-label');
    });

    it('should work with screen readers', () => {
      cy.visit('/orders');

      // Check for screen reader text
      cy.get('[data-testid="order-card"]').first().within(() => {
        cy.get('.sr-only').should('contain', 'Заказ номер');
      });
    });
  });
});
