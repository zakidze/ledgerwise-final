'use client';

import React from 'react';
import { showToast } from '@/lib/toast';

interface JsonModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: unknown;
  title?: string;
}

export default function JsonModal({ isOpen, onClose, data, title = 'Raw Leads JSON' }: JsonModalProps) {
  if (!isOpen) return null;

  const jsonString = JSON.stringify(data, null, 2);

  const copyJson = () => {
    navigator.clipboard.writeText(jsonString);
    showToast('JSON copied to clipboard!');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="text-[#94a3b8] hover:text-white cursor-pointer" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <pre className="text-[#38bdf8] font-mono text-[0.78rem] overflow-auto max-h-[400px] bg-[#090e18] p-3 rounded-lg border border-[#263554]">
            {jsonString}
          </pre>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={copyJson}>
            Copy JSON
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
