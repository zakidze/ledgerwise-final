import type { Metadata } from 'next';
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
        <Header />
        <FlowBanner />
        <main className="flex-1 flex flex-col max-w-[1700px] w-full mx-auto p-5">
          {children}
        </main>
        <Toast />
      </body>
    </html>
  );
}
