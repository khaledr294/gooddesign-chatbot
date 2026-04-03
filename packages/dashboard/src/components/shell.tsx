'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getAgent, logout } from '@/lib/api';

interface Agent {
  id: string;
  name: string;
  email: string;
  role: string;
}

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const a = getAgent();
    if (!a && pathname !== '/login') {
      router.replace('/login');
    } else if (a && pathname === '/login') {
      router.replace('/');
    } else {
      setAgent(a);
    }
    setLoading(false);
  }, [pathname, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950 text-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-600 border-t-blue-500" />
      </div>
    );
  }

  if (pathname === '/login') return <>{children}</>;

  if (!agent) return null;

  return <>{children}</>;
}

export function Sidebar() {
  const pathname = usePathname();
  const agent = getAgent();

  if (pathname === '/login') return null;

  const links = [
    { href: '/', label: 'الرئيسية', icon: '📊' },
    { href: '/conversations', label: 'المحادثات', icon: '💬' },
    { href: '/orders', label: 'الطلبات', icon: '📦' },
    { href: '/settings', label: 'الإعدادات', icon: '⚙️' },
  ];

  return (
    <aside className="fixed right-0 top-0 h-screen w-56 border-l border-gray-800 bg-gray-950 flex flex-col">
      <div className="p-4 border-b border-gray-800">
        <h1 className="text-lg font-bold text-white">Good Design</h1>
        <p className="text-xs text-gray-400">لوحة التحكم</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {links.map((l) => {
          const active = l.href === '/' ? pathname === '/' : pathname.startsWith(l.href);
          return (
            <a
              key={l.href}
              href={l.href}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <span>{l.icon}</span>
              <span>{l.label}</span>
            </a>
          );
        })}
      </nav>

      <div className="border-t border-gray-800 p-3">
        <div className="mb-2 text-xs text-gray-400 truncate">{agent?.name}</div>
        <button
          onClick={logout}
          className="w-full rounded-lg bg-red-600/20 px-3 py-1.5 text-xs text-red-400 hover:bg-red-600/30 transition-colors"
        >
          تسجيل الخروج
        </button>
      </div>
    </aside>
  );
}
