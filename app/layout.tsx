import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import Header from '@/components/Header';
import FlowBanner from '@/components/FlowBanner';
import Toast from '@/components/Toast';

export const metadata: Metadata = {
  title: 'Ledgerwise B2B Outbound Suite',
  description: 'B2B Bookkeeping Outbound Engine & Autonomous SDR',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-[#0b0f19] text-[#f1f5f9]">
        <Suspense fallback={<div className="h-16 bg-[#151d30] border-b border-[#263554]" />}>
          <Header />
        </Suspense>
        <Suspense fallback={<div className="h-10 bg-[#090e18] border-b border-[#263554]" />}>
          <FlowBanner />
        </Suspense>
        <main className="flex-1 flex flex-col max-w-[1700px] w-full mx-auto p-5">
          <Suspense fallback={<div className="py-12 text-center text-[#94a3b8]">Loading...</div>}>
            {children}
          </Suspense>
        </main>
        <Toast />
      </body>
    </html>
  );
}
