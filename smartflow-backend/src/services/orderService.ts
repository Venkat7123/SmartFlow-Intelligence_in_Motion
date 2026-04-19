// ──────────────────────────────────────────────
//  Service: OrderService
//  Firestore operations for users/{uid}/orders.
// ──────────────────────────────────────────────
import { db } from '../config/firebase';
import { Order } from '../types';

class OrderService {
  async getMyOrders(userId: string): Promise<Order[]> {
    const snapshot = await db
      .collection('users')
      .doc(userId)
      .collection('orders')
      .get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Order));
  }

  async createOrder(userId: string, data: Omit<Order, 'id'>): Promise<Order> {
    const ref = await db
      .collection('users')
      .doc(userId)
      .collection('orders')
      .add({
        ...data,
        createdAt: new Date().toISOString(),
      });
    const created = await ref.get();
    return { id: created.id, ...created.data() } as Order;
  }

  async updateOrderStatus(
    userId: string,
    orderId: string,
    status: Order['status']
  ): Promise<Order> {
    const ref = db.collection('users').doc(userId).collection('orders').doc(orderId);
    await ref.update({ status, updatedAt: new Date().toISOString() });
    const updated = await ref.get();
    return { id: updated.id, ...updated.data() } as Order;
  }
}

export default new OrderService();
