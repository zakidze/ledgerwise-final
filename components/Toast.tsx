'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ToastData } from '@/lib/toast';

export default function Toast() {
  const [toast, setToast] = useState<ToastData | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    const handleToast = (e: Event) => {
      const custom = e as CustomEvent<ToastData>;
      setToast(custom.detail);
      setVisible(true);

      clearTimeout(timer);
      timer = setTimeout(() => {
        setVisible(false);
      }, custom.detail.duration || 4500);
    };

    window.addEventListener('ledgerwise-toast', handleToast);
    return () => {
      window.removeEventListener('ledgerwise-toast', handleToast);
      clearTimeout(timer);
    };
  }, []);

  if (!toast) return null;

  return (
    <div
      className={`fixed bottom-6 right-6 bg-[#151d30] border border-[#10b981] text-white px-4 py-3 rounded-[10px] text-[0.85rem] font-semibold flex items-center gap-3 shadow-[0_8px_24px_rgba(0,0,0,0.4)] z-[9999] transition-all duration-300 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-28 opacity-0 pointer-events-none'
      }`}
    >
      <span>{toast.message}</span>
      {toast.actionText && toast.actionHref && (
        <Link
          href={toast.actionHref}
          onClick={() => setVisible(false)}
          className="btn btn-accent btn-small py-1 px-2.5 text-[0.75rem]"
        >
          {toast.actionText}
        </Link>
      )}
      <button
        onClick={() => setVisible(false)}
        className="text-[#94a3b8] hover:text-white text-xs ml-2 cursor-pointer"
      >
        ✕
      </button>
    </div>
  );
}
