import React, { useState, useEffect, useId } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { FiSave } from 'react-icons/fi';
import api from '../config/api';
import { useAuth } from '../context/AuthContext';
import Modal from './Modal';
import LoadingButton from './LoadingButton';
import {
  CRM_TYPE_CONFIG as TYPE_CONFIG,
  CRM_STATUS_CONFIG as STATUS_CONFIG,
  crmDateKey as dateKey,
} from './CrmTimeline';
import '../pages/CRM.css';

const VALID_STATUSES = Object.keys(STATUS_CONFIG);

export function emptyCrmInteractionForm(candidateId = '') {
  return {
    candidate_id: candidateId ? String(candidateId) : '',
    interaction_type: 'call',
    interaction_date: new Date().toISOString().split('T')[0],
    notes: '',
    follow_up_date: '',
    status: 'open',
  };
}

function interactionToForm(row) {
  const typeKey = row.interaction_type && TYPE_CONFIG[row.interaction_type] ? row.interaction_type : 'note';
  return {
    candidate_id: row.candidate_id != null ? String(row.candidate_id) : '',
    interaction_type: typeKey,
    interaction_date: dateKey(row.interaction_date) || new Date().toISOString().split('T')[0],
    notes: row.notes || '',
    follow_up_date: row.follow_up_date ? dateKey(row.follow_up_date) : '',
    status: VALID_STATUSES.includes(row.status) ? row.status : 'open',
  };
}

const CrmInteractionModal = ({
  open,
  onClose,
  interaction = null,
  candidateId = '',
  lockCandidate = false,
  candidateLabel = '',
  fallbackCandidateLabel = '',
}) => {
  const fieldId = useId().replace(/:/g, '');
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(emptyCrmInteractionForm());

  const canWrite = user?.role === 'consultant' || user?.role === 'admin';
  const isEditing = Boolean(interaction?.id);

  const { data: candidates } = useQuery(
    ['crm-candidates', user?.role],
    () =>
      user?.role === 'admin'
        ? api.get('/candidates').then((res) => res.data)
        : api.get('/candidates/assigned').then((res) => res.data),
    { enabled: open && canWrite && !lockCandidate }
  );

  useEffect(() => {
    if (!open) return;
    if (interaction) {
      setFormData(interactionToForm(interaction));
      return;
    }
    setFormData(emptyCrmInteractionForm(lockCandidate ? candidateId : candidateId || ''));
  }, [open, interaction, candidateId, lockCandidate]);

  const createMutation = useMutation((data) => api.post('/crm', data), {
    onSuccess: () => {
      queryClient.invalidateQueries('crm');
      queryClient.invalidateQueries(['candidate']);
      onClose?.();
    },
    onError: (e) => window.alert(e.response?.data?.error || e.message),
  });

  const updateMutation = useMutation(({ id, data }) => api.put(`/crm/${id}`, data), {
    onSuccess: () => {
      queryClient.invalidateQueries('crm');
      queryClient.invalidateQueries(['candidate']);
      onClose?.();
    },
    onError: (e) => window.alert(e.response?.data?.error || e.message),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      candidate_id: parseInt(formData.candidate_id, 10),
      interaction_type: formData.interaction_type,
      interaction_date: formData.interaction_date,
      notes: formData.notes || null,
      follow_up_date: formData.follow_up_date || null,
      status: formData.status,
    };
    if (isEditing) {
      updateMutation.mutate({ id: interaction.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const saving = createMutation.isLoading || updateMutation.isLoading;
  const lockedLabel =
    candidateLabel ||
    fallbackCandidateLabel ||
    (candidateId ? `Candidate #${candidateId}` : '');

  if (!canWrite) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      contentClassName="crm-modal"
      ariaLabel={isEditing ? 'Edit interaction' : 'Log interaction'}
    >
      <h2>{isEditing ? 'Edit interaction' : 'Log interaction'}</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor={`${fieldId}-candidate`}>Candidate</label>
          {lockCandidate ? (
            <div className="crm-modal-candidate-lock" id={`${fieldId}-candidate`}>
              {lockedLabel}
            </div>
          ) : (
            <select
              id={`${fieldId}-candidate`}
              value={formData.candidate_id}
              onChange={(e) => setFormData({ ...formData, candidate_id: e.target.value })}
              required
            >
              <option value="">Select candidate</option>
              {formData.candidate_id &&
                !candidates?.some((c) => String(c.id) === String(formData.candidate_id)) && (
                  <option value={formData.candidate_id}>
                    {fallbackCandidateLabel || `Candidate #${formData.candidate_id}`}
                  </option>
                )}
              {candidates?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name}
                  {c.email ? ` (${c.email})` : ''}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="form-group">
          <label htmlFor={`${fieldId}-type`}>Interaction type</label>
          <select
            id={`${fieldId}-type`}
            value={formData.interaction_type}
            onChange={(e) => setFormData({ ...formData, interaction_type: e.target.value })}
            required
          >
            {Object.entries(TYPE_CONFIG).map(([k, { label }]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor={`${fieldId}-date`}>Date</label>
            <input
              id={`${fieldId}-date`}
              type="date"
              value={formData.interaction_date}
              onChange={(e) => setFormData({ ...formData, interaction_date: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor={`${fieldId}-status`}>Status</label>
            <select
              id={`${fieldId}-status`}
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            >
              {Object.entries(STATUS_CONFIG).map(([k, { label }]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label htmlFor={`${fieldId}-notes`}>Notes</label>
          <textarea
            id={`${fieldId}-notes`}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={5}
            placeholder="Outcomes, next steps, objections…"
          />
        </div>
        <div className="form-group">
          <label htmlFor={`${fieldId}-follow`}>Follow-up date (optional)</label>
          <input
            id={`${fieldId}-follow`}
            type="date"
            value={formData.follow_up_date}
            onChange={(e) => setFormData({ ...formData, follow_up_date: e.target.value })}
          />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <LoadingButton
            type="submit"
            className="btn btn-primary"
            icon={FiSave}
            loading={saving}
            loadingLabel="Saving…"
          >
            {isEditing ? 'Save changes' : 'Create'}
          </LoadingButton>
        </div>
      </form>
    </Modal>
  );
};

export default CrmInteractionModal;
