import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import { Providers } from '@/lib/providers';

const geist = Geist({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'TradeOS',
  description: 'AI-first operating system for skilled trades businesses',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={geist.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}