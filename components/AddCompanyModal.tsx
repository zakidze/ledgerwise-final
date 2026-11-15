'use client';

import React, { useState } from 'react';
import { useSavedCompanies } from '@/lib/hooks';
import { showToast } from '@/lib/toast';
import { SavedCompany, IcpScore } from '@/lib/types';

interface AddCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddCompanyModal({ isOpen, onClose }: AddCompanyModalProps) {
  const { addCompany } = useSavedCompanies();

  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [url, setUrl] = useState('');
  const [personaName, setPersonaName] = useState('');
  const [personaTitle, setPersonaTitle] = useState('');
  const [revenue, setRevenue] = useState('');
  const [trigger, setTrigger] = useState('');
  const [score, setScore] = useState<IcpScore>('High');

  if (!isOpen) return null;

  const handleSave = () => {
    if (!name.trim() || !domain.trim()) {
      alert('Please enter Company Name and Domain.');
      return;
    }

    const newCompany: SavedCompany = {
      id: 'comp_' + Date.now(),
      company_name: name.trim(),
      domain: domain.trim().toLowerCase(),
      website_url: url.trim() || `https://${domain.trim()}`,
      us_state: 'US',
      founded_year: 'N/A',
      est_revenue_and_size: revenue.trim() || '$5M–$10M / 20 employees',
      target_person_name: personaName.trim() || 'Founder',
      target_person_title: personaTitle.trim() || 'Co-Founder / COO',
      trigger_reason: trigger.trim() || 'E-commerce channel expansion',
      verified_source_link: url.trim() || `https://${domain.trim()}`,
      verified_quote: trigger.trim() || 'Expanding product distribution.',
      icp_score: score,
      score_justification: 'Manually added qualified prospective brand.',
      status: 'SAVED',
      saved_at: new Date().toISOString(),
      channels: ['DTC', 'Retail'],
    };

    const success = addCompany(newCompany);
    if (!success) {
      alert('Company already exists in your saved pipeline.');
      return;
    }

    setName('');
    setDomain('');
    setUrl('');
    setPersonaName('');
    setPersonaTitle('');
    setRevenue('');
    setTrigger('');
    onClose();

    showToast(`Added "${newCompany.company_name}" to pipeline!`, 'Draft Email ➔', '/draft-email');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>+ Add Company to Pipeline Manually</h3>
          <button className="text-[#94a3b8] hover:text-white cursor-pointer" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="criteria-group">
            <label>Company Name *</label>
            <input
              type="text"
              placeholder="e.g. Bala"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="criteria-group">
            <label>Domain *</label>
            <input
              type="text"
              placeholder="e.g. shopbala.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
          </div>
          <div className="criteria-group">
            <label>Website URL</label>
            <input
              type="text"
              placeholder="https://shopbala.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div className="criteria-group">
            <label>Target Persona Name</label>
            <input
              type="text"
              placeholder="e.g. Natalie Holloway"
              value={personaName}
              onChange={(e) => setPersonaName(e.target.value)}
            />
          </div>
          <div className="criteria-group">
            <label>Target Persona Title</label>
            <input
              type="text"
              placeholder="e.g. Co-Founder / COO"
              value={personaTitle}
              onChange={(e) => setPersonaTitle(e.target.value)}
            />
          </div>
          <div className="criteria-group">
            <label>Est Revenue & Size</label>
            <input
              type="text"
              placeholder="e.g. $5M–$10M / 20 employees"
              value={revenue}
              onChange={(e) => setRevenue(e.target.value)}
            />
          </div>
          <div className="criteria-group">
            <label>Growth Trigger Reason</label>
            <input
              type="text"
              placeholder="e.g. Retail rollout into Target and Dick's"
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
            />
          </div>
          <div className="criteria-group">
            <label>ICP Score</label>
            <select
              value={score}
              onChange={(e) => setScore(e.target.value as IcpScore)}
            >
              <option value="High">High</option>
              <option value="Medium-High">Medium-High</option>
              <option value="Medium">Medium</option>
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-accent" onClick={handleSave}>
            Save Company
          </button>
        </div>
      </div>
    </div>
  );
}
