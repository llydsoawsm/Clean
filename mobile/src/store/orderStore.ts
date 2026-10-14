import type { OrderRow, OrderStatus } from '@/db/types';

export interface LocalOrder {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name: string;
  customer_contact: string;
  service_id: string;
  service_name: string;
  pricing_type: string;
  quantity_or_weight: number;
  total_centavos: number;
  paid_centavos: number;
  balance_centavos: number;
  status: OrderStatus;
  payment_status: 'PAID' | 'PARTIAL' | 'UNPAID';
  notes?: string;
  created_at: string;
}

export interface LocalPayment {
  id: string;
  order_id: string;
  order_number: string;
  customer_name: string;
  amount_centavos: number;
  method: 'CASH' | 'GCASH' | 'OTHER';
  reference?: string;
  created_at: string;
}

let orders: LocalOrder[] = [];

let payments: LocalPayment[] = [];

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export const orderStore = {
  getAll(): LocalOrder[] {
    return [...orders];
  },

  getById(id: string): LocalOrder | undefined {
    return orders.find((o) => o.id === id);
  },

  getCounts(): { RECEIVED: number; PROCESSING: number; READY: number; COMPLETED: number; ALL: number } {
    const todayStr = new Date().toDateString();
    const todayOrders = orders.filter((o) => new Date(o.created_at).toDateString() === todayStr);
    const counts = { RECEIVED: 0, PROCESSING: 0, READY: 0, COMPLETED: 0, ALL: todayOrders.length };
    todayOrders.forEach((o) => {
      if (o.status === 'RECEIVED') counts.RECEIVED++;
      else if (o.status === 'PROCESSING') counts.PROCESSING++;
      else if (o.status === 'READY') counts.READY++;
      else if (o.status === 'COMPLETED') counts.COMPLETED++;
    });
    return counts;
  },

  getFinancials(): { collectedToday: number; outstandingBalance: number } {
    let collectedToday = 0;
    let outstandingBalance = 0;

    const todayDate = new Date().toDateString();
    const orderIds = new Set(orders.map((o) => o.id));

    // Only count payments that correspond to existing orders
    payments.forEach((p) => {
      if (orderIds.has(p.order_id) && new Date(p.created_at).toDateString() === todayDate) {
        collectedToday += p.amount_centavos;
      }
    });

    orders.forEach((o) => {
      outstandingBalance += o.balance_centavos;
    });

    return { collectedToday, outstandingBalance };
  },

  getAllPayments(): LocalPayment[] {
    return [...payments];
  },

  createOrder(input: {
    customer_id: string;
    customer_name: string;
    customer_contact: string;
    service_id: string;
    service_name: string;
    pricing_type: string;
    quantity_or_weight: number;
    total_centavos: number;
    paid_centavos: number;
    notes?: string;
  }): LocalOrder {
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const seq = String(orders.length + 1).padStart(4, '0');
    const orderNumber = `CLN-${ymd}-${seq}`;

    const balance = Math.max(0, input.total_centavos - input.paid_centavos);
    const paymentStatus = balance === 0 ? 'PAID' : input.paid_centavos > 0 ? 'PARTIAL' : 'UNPAID';

    const newOrder: LocalOrder = {
      id: `ord-${Date.now()}`,
      order_number: orderNumber,
      customer_id: input.customer_id,
      customer_name: input.customer_name,
      customer_contact: input.customer_contact,
      service_id: input.service_id,
      service_name: input.service_name,
      pricing_type: input.pricing_type,
      quantity_or_weight: input.quantity_or_weight,
      total_centavos: input.total_centavos,
      paid_centavos: input.paid_centavos,
      balance_centavos: balance,
      status: 'RECEIVED',
      payment_status: paymentStatus,
      notes: input.notes,
      created_at: new Date().toISOString(),
    };

    orders = [newOrder, ...orders];

    if (input.paid_centavos > 0) {
      const newPay: LocalPayment = {
        id: `pay-${Date.now()}`,
        order_id: newOrder.id,
        order_number: newOrder.order_number,
        customer_name: newOrder.customer_name,
        amount_centavos: input.paid_centavos,
        method: 'CASH',
        created_at: new Date().toISOString(),
      };
      payments = [newPay, ...payments];
    }

    notify();
    return newOrder;
  },

  updateStatus(id: string, newStatus: OrderStatus): { success: boolean; error?: string } {
    const ord = orders.find((o) => o.id === id);
    if (!ord) return { success: false, error: 'Order not found' };

    if (newStatus === 'COMPLETED' && ord.balance_centavos > 0) {
      return {
        success: false,
        error: 'Cannot complete order: Payment is not yet fully paid.',
      };
    }

    orders = orders.map((o) => (o.id === id ? { ...o, status: newStatus } : o));
    notify();
    return { success: true };
  },

  addPayment(orderId: string, amountCentavos: number, method: 'CASH' | 'GCASH' | 'OTHER' = 'CASH', reference?: string): void {
    const ord = orders.find((o) => o.id === orderId);
    if (!ord) return;

    const newPaid = ord.paid_centavos + amountCentavos;
    const newBal = Math.max(0, ord.total_centavos - newPaid);
    const newStatus = newBal === 0 ? 'PAID' : 'PARTIAL';

    orders = orders.map((o) => (o.id === orderId ? { ...o, paid_centavos: newPaid, balance_centavos: newBal, payment_status: newStatus } : o));

    const newPay: LocalPayment = {
      id: `pay-${Date.now()}`,
      order_id: ord.id,
      order_number: ord.order_number,
      customer_name: ord.customer_name,
      amount_centavos: amountCentavos,
      method: method,
      reference: reference,
      created_at: new Date().toISOString(),
    };
    payments = [newPay, ...payments];
    notify();
  },

  truncateOrders(): void {
    orders = [];
    notify();
  },

  clearOrders(): void {
    orders = [];
    notify();
  },

  truncatePayments(): void {
    payments = [];
    notify();
  },

  clearPayments(): void {
    payments = [];
    notify();
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
