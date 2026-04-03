'use client';

import useSWR from 'swr';
import { apiFetch } from '@/lib/api';

export default function StatsPage() {
  const { data: stats } = useSWR('/stats', apiFetch, { refreshInterval: 30000 });

  const cards = [
    { label: 'إجمالي المحادثات', value: stats?.totalConversations ?? '—', color: 'blue' },
    { label: 'محادثات نشطة', value: stats?.activeConversations ?? '—', color: 'green' },
    { label: 'إجمالي الطلبات', value: stats?.totalOrders ?? '—', color: 'purple' },
    { label: 'معدل التحويل', value: stats?.conversionRate ? `${stats.conversionRate}%` : '—', color: 'orange' },
  ];

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-600/20 text-blue-400',
    green: 'bg-green-600/20 text-green-400',
    purple: 'bg-purple-600/20 text-purple-400',
    orange: 'bg-orange-600/20 text-orange-400',
  };

  return (
    <div className="p-6">
      <h2 className="mb-6 text-xl font-bold">الرئيسية</h2>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl bg-gray-900 p-5">
            <p className="text-sm text-gray-400">{c.label}</p>
            <p className={`mt-1 text-3xl font-bold ${colorMap[c.color]?.split(' ')[1]}`}>
              {c.value}
            </p>
          </div>
        ))}
      </div>

      {/* Top Products */}
      <div className="mb-8 rounded-xl bg-gray-900 p-5">
        <h3 className="mb-4 text-lg font-semibold">أكثر المنتجات طلباً</h3>
        {stats?.topProducts?.length ? (
          <div className="space-y-2">
            {stats.topProducts.map((p: any, i: number) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-gray-800 px-4 py-2">
                <span className="text-sm">{p.productName || p.productId}</span>
                <span className="text-sm font-medium text-blue-400">{p.totalQuantity} طلب</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">لا توجد بيانات بعد</p>
        )}
      </div>

      {/* Agent Performance */}
      <div className="rounded-xl bg-gray-900 p-5">
        <h3 className="mb-4 text-lg font-semibold">أداء الموظفين</h3>
        {stats?.agentStats?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400">
                  <th className="pb-2 text-right">الموظف</th>
                  <th className="pb-2 text-right">المحادثات</th>
                  <th className="pb-2 text-right">الرسائل</th>
                </tr>
              </thead>
              <tbody>
                {stats.agentStats.map((a: any) => (
                  <tr key={a.id} className="border-b border-gray-800/50">
                    <td className="py-2">{a.name}</td>
                    <td className="py-2">{a._count?.conversations ?? 0}</td>
                    <td className="py-2">{a._count?.messages ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500">لا توجد بيانات بعد</p>
        )}
      </div>
    </div>
  );
}
