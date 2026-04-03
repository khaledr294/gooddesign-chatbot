'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { apiFetch } from '@/lib/api';

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  paymentMethod: string | null;
  total: number;
  subtotal: number;
  createdAt: string;
  user?: { name: string | null; phone: string };
  items: { id: string; quantity: number; unitPrice: number; totalPrice: number; product: { name: string; imageUrl: string | null } }[];
  conversation?: { id: string; channel: string };
}

interface OrdersResponse {
  data: Order[];
  total: number;
  page: number;
  limit: number;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'قيد الانتظار',
  AWAITING_PAYMENT: 'بانتظار الدفع',
  PAYMENT_RECEIVED: 'تم الدفع',
  IN_DESIGN: 'قيد التصميم',
  IN_PRODUCTION: 'قيد التصنيع',
  SHIPPED: 'تم الشحن',
  DELIVERED: 'تم التوصيل',
  CANCELLED: 'ملغى',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-600/20 text-yellow-400',
  AWAITING_PAYMENT: 'bg-orange-600/20 text-orange-400',
  PAYMENT_RECEIVED: 'bg-blue-600/20 text-blue-400',
  IN_DESIGN: 'bg-indigo-600/20 text-indigo-400',
  IN_PRODUCTION: 'bg-purple-600/20 text-purple-400',
  SHIPPED: 'bg-orange-600/20 text-orange-400',
  DELIVERED: 'bg-green-600/20 text-green-400',
  CANCELLED: 'bg-red-600/20 text-red-400',
};

export default function OrdersPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);

  const { data: ordersResponse } = useSWR<OrdersResponse>(
    `/orders${statusFilter ? `?status=${statusFilter}` : ''}`,
    apiFetch,
    { refreshInterval: 15000 }
  );
  const orders: Order[] = ordersResponse?.data ?? [];

  const { data: detail } = useSWR<Order>(
    selectedOrder ? `/orders/${selectedOrder}` : null,
    apiFetch
  );

  async function updateStatus(orderId: string, status: string) {
    await apiFetch(`/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    mutate(`/orders${statusFilter ? `?status=${statusFilter}` : ''}`);
    mutate(`/orders/${orderId}`);
  }

  async function confirmPayment(orderId: string) {
    await apiFetch(`/orders/${orderId}/confirm-payment`, { method: 'POST' });
    mutate(`/orders${statusFilter ? `?status=${statusFilter}` : ''}`);
    mutate(`/orders/${orderId}`);
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white"
        >
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <h2 className="text-xl font-bold">الطلبات</h2>
      </div>

      <div className="rounded-xl bg-gray-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400">
              <th className="p-3 text-right">إجراءات</th>
              <th className="p-3 text-right">المبلغ</th>
              <th className="p-3 text-right">الحالة</th>
              <th className="p-3 text-right">الدفع</th>
              <th className="p-3 text-right">العميل</th>
              <th className="p-3 text-right">رقم الطلب</th>
              <th className="p-3 text-right">التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr
                key={o.id}
                className="border-b border-gray-800/50 hover:bg-gray-800/50 cursor-pointer"
                onClick={() => setSelectedOrder(o.id)}
              >
                <td className="p-3">
                  <div className="flex gap-1">
                    {o.status === 'PENDING' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); confirmPayment(o.id); }}
                        className="rounded bg-green-600/20 px-2 py-1 text-xs text-green-400 hover:bg-green-600/30"
                      >
                        تأكيد الدفع
                      </button>
                    )}
                    {o.status !== 'DELIVERED' && o.status !== 'CANCELLED' && (
                      <select
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => { updateStatus(o.id, e.target.value); e.target.value = ''; }}
                        defaultValue=""
                        className="rounded border border-gray-700 bg-gray-800 px-1 py-1 text-xs text-white"
                      >
                        <option value="" disabled>تغيير الحالة</option>
                        {Object.entries(STATUS_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </td>
                <td className="p-3 font-medium">{o.total} ر.س</td>
                <td className="p-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[o.status] || ''}`}>
                    {STATUS_LABELS[o.status] || o.status}
                  </span>
                </td>
                <td className="p-3 text-gray-400">{o.paymentMethod === 'BANK_TRANSFER' ? 'تحويل بنكي' : 'سلة'}</td>
                <td className="p-3">{o.user?.name || o.user?.phone || '—'}</td>
                <td className="p-3 font-mono text-blue-400">{o.orderNumber}</td>
                <td className="p-3 text-gray-400">
                  {new Date(o.createdAt).toLocaleDateString('ar-SA')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && (
          <p className="p-8 text-center text-sm text-gray-500">لا توجد طلبات</p>
        )}
      </div>

      {/* Order Detail Modal */}
      {detail && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelectedOrder(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-gray-900 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-white">✕</button>
              <h3 className="text-lg font-bold">طلب {detail.orderNumber}</h3>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[detail.status] || ''}`}>
                  {STATUS_LABELS[detail.status]}
                </span>
                <span className="text-gray-400">الحالة:</span>
              </div>
              <div className="flex justify-between">
                <span>{detail.user?.name || '—'}</span>
                <span className="text-gray-400">العميل:</span>
              </div>
              <div className="flex justify-between">
                <span dir="ltr">{detail.user?.phone}</span>
                <span className="text-gray-400">الهاتف:</span>
              </div>

              <h4 className="mt-4 font-semibold border-b border-gray-800 pb-2">المنتجات:</h4>
              {detail.items?.map((item) => (
                <div key={item.id} className="flex justify-between rounded-lg bg-gray-800 px-3 py-2">
                  <span className="font-medium">{item.totalPrice} ر.س</span>
                  <span>{item.product?.name} × {item.quantity}</span>
                </div>
              ))}

              <div className="flex justify-between border-t border-gray-800 pt-3 font-bold">
                <span className="text-blue-400">{detail.total} ر.س</span>
                <span>الإجمالي:</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
