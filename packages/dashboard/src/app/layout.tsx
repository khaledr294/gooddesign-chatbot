import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Good Design - لوحة التحكم',
  description: 'لوحة التحكم لإدارة الشاتبوت والطلبات',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="bg-gray-950 text-gray-100 font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
