import React from 'react';
import { Container, Box } from '@mui/material';
import PaymentVerification from '../components/ecommerce/PaymentVerification';
import { useNotifications } from '../contexts/NotificationContext';

export default function PaymentVerificationPage() {
  const { addNotification } = useNotifications();

  const handleOrderUpdate = async (orderId: string, action: 'approve' | 'reject', reason?: string) => {
    try {
      const endpoint = action === 'approve' ? 'confirm-payment' : 'reject';
      const payload = action === 'reject' ? { reason } : {};
      const token = localStorage.getItem('accessToken') || localStorage.getItem('authToken');

      const response = await fetch(`/api/orders/${orderId}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to update order');
      }

      addNotification({
        type: 'success',
        title: 'Заказ обновлен',
        message: action === 'approve' 
          ? 'Оплата успешно подтверждена' 
          : 'Заказ отклонен',
      });
    } catch (error) {
      console.error('Error updating order:', error);
      addNotification({
        type: 'error',
        title: 'Ошибка',
        message: 'Произошла ошибка при обновлении заказа',
      });
    }
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 3 }}>
        <PaymentVerification onOrderUpdate={handleOrderUpdate} />
      </Box>
    </Container>
  );
}
