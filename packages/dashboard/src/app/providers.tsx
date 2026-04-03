'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { SocketProvider } from '@/lib/socket';
import { AuthGuard, Sidebar } from '@/components/shell';

export function Providers({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === '/login';

  return (
    <AuthGuard>
      {isLogin ? (
        children
      ) : (
        <SocketProvider>
          <Sidebar />
          <main className="mr-56">{children}</main>
        </SocketProvider>
      )}
    </AuthGuard>
  );
}
