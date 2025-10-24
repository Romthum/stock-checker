import type { Metadata } from 'next';
import './globals.css';
import { Prompt, Inter } from 'next/font/google';

const prompt = Prompt({ subsets: ['thai','latin'], weight: ['300','400','500','600','700'], variable: '--font-sans', display: 'swap' });
const inter = Inter({ subsets: ['latin'], weight: ['400','600'], variable: '--font-en', display: 'swap' });

export const metadata: Metadata = {
  title: 'Stock Checker',
  description: 'ระบบเช็กสินค้าแบบมินิมอล',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className="h-full" suppressHydrationWarning>
      <body className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 antialiased">
        <main className="max-w-screen-md mx-auto px-3 py-4">{children}</main>
      </body>
    </html>
  );
}
