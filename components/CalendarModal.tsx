'use client';

import React from 'react';
import { useCalendar, useSavedCompanies } from '@/lib/hooks';
import { getRealAvailableCalendarSlots } from '@/lib/calendar';
import { showToast } from '@/lib/toast';

interface CalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CalendarModal({ isOpen, onClose }: CalendarModalProps) {
  const { activeMeeting, bookSlot, rescheduleSlot } = useCalendar();
  const { activeCompany } = useSavedCompanies();

  if (!isOpen) return null;

  const availSlots = getRealAvailableCalendarSlots(3);

  const handleBook = (dateStr: string, slotTime: string) => {
    const comp = activeCompany || { company_name: 'Bala', target_person_name: 'Natalie Holloway' };
    const success = bookSlot(dateStr, slotTime, comp);
    if (success) {
      showToast(`🏆 Booked call on ${dateStr} at ${slotTime}!`);
      onClose();
    } else {
      alert('Could not book slot: slot is blocked or already booked.');
    }
  };

  const handleReschedule = (dateStr: string, slotTime: string) => {
    const success = rescheduleSlot(dateStr, slotTime);
    if (success) {
      showToast(`🔄 Rescheduled meeting to ${dateStr} at ${slotTime}!`);
      onClose();
    } else {
      alert('Could not reschedule: selected slot is blocked or unavailable.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Ledgerwise Calendar & Meeting Dispatch</h3>
          <button className="text-[#94a3b8] hover:text-white cursor-pointer" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          {activeMeeting ? (
            <div>
              <div className="bg-[#090e18] border border-[#10b981] rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="badge badge-high">{activeMeeting.status}</span>
                  <span className="text-[0.75rem] text-[#94a3b8]">Event #{activeMeeting.id}</span>
                </div>
                <h4 className="text-[1.05rem] text-white font-bold mb-1">Ledgerwise Discovery Call</h4>
                <div className="text-[#38bdf8] font-semibold text-[0.95rem] mb-3">
                  🗓️ {activeMeeting.timeSlot}
                </div>
                <div className="text-[0.8rem] text-[#cbd5e1] flex flex-col gap-1">
                  <div>
                    👤 <strong>Prospect:</strong> {activeMeeting.prospectName} ({activeMeeting.companyName})
                  </div>
                  <div>
                    ⚡ <strong>Host:</strong> Alex (Ledgerwise Senior Accounting Advisory)
                  </div>
                  <div>
                    📍 <strong>Link:</strong> Google Meet (meet.google.com/lw-scope-call)
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <label className="text-[0.75rem] text-[#94a3b8] font-bold block mb-1">
                  Reschedule into Real Available Slots:
                </label>
                <div className="flex gap-2 flex-wrap mt-2">
                  {availSlots.map((as) => (
                    <button
                      key={as.formatted}
                      className="btn btn-outline btn-small"
                      onClick={() => handleReschedule(as.dateStr, as.slotTime)}
                    >
                      {as.formatted}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center p-4">
              <div className="text-3xl mb-2">📅</div>
              <h4 className="text-[0.95rem] text-white font-semibold mb-2">
                Available Slots from Real Calendar
              </h4>
              <p className="text-xs text-[#94a3b8] mb-4">
                Select an open time slot to book a 15-minute discovery call for {activeCompany?.company_name || 'active company'}:
              </p>
              <div className="flex gap-2 justify-center flex-wrap">
                {availSlots.map((as) => (
                  <button
                    key={as.formatted}
                    className="btn btn-accent btn-small"
                    onClick={() => handleBook(as.dateStr, as.slotTime)}
                  >
                    Book: {as.formatted}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
