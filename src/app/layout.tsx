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
    <html lang="th">
      <body className={`${prompt.variable} ${inter.variable} bg-white text-zinc-900`}>
        <div className="mx-auto max-w-screen-sm min-h-[100dvh] px-4">
          {children}
        </div>
      </body>
    </html>
  );
}
