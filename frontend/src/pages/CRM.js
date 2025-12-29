import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../config/api';
import { useAuth } from '../context/AuthContext';
import { FiPlus } from 'react-icons/fi';
import './CRM.css';

const CRM = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    candidate_id: '',
    interaction_type: 'call',
    interaction_date: new Date().toISOString().split('T')[0],
    notes: '',
    follow_up_date: '',
    status: 'open',
  });

  const { data: interactions, isLoading } = useQuery(
    'crm',
    () => api.get('/crm').then(res => res.data)
  );

  const { data: candidates } = useQuery(
    'assigned-candidates',
    () => api.get('/candidates/assigned').then(res => res.data),
    { enabled: user?.role === 'consultant' }
  );

  const createMutation = useMutation(
    (data) => api.post('/crm', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('crm');
        setShowModal(false);
        setFormData({
          candidate_id: '',
          interaction_type: 'call',
          interaction_date: new Date().toISOString().split('T')[0],
          notes: '',
          follow_up_date: '',
          status: 'open',
        });
      },
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  if (isLoading) {
    return <div className="loading">Loading CRM interactions...</div>;
  }

  return (
    <div className="crm-page">
      <div className="page-header">
        <h1>CRM Interactions</h1>
        {user?.role === 'consultant' && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <FiPlus /> New Interaction
          </button>
        )}
      </div>

      <div className="crm-list">
        {interactions && interactions.length > 0 ? (
          interactions.map((interaction) => (
            <div key={interaction.id} className="crm-card">
              <div className="crm-header">
                <h3>{interaction.interaction_type}</h3>
                <span className={`badge badge-${interaction.status === 'open' ? 'warning' : 'success'}`}>
                  {interaction.status}
                </span>
              </div>
              <p className="crm-candidate">
                Candidate: {interaction.candidate_first_name} {interaction.candidate_last_name}
              </p>
              <p className="crm-date">
                Date: {new Date(interaction.interaction_date).toLocaleDateString()}
              </p>
              {interaction.notes && (
                <p className="crm-notes">{interaction.notes}</p>
              )}
              {interaction.follow_up_date && (
                <p className="crm-followup">
                  Follow-up: {new Date(interaction.follow_up_date).toLocaleDateString()}
                </p>
              )}
            </div>
          ))
        ) : (
          <div className="empty-state">No CRM interactions found</div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>New CRM Interaction</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Candidate</label>
                <select
                  value={formData.candidate_id}
                  onChange={(e) => setFormData({ ...formData, candidate_id: e.target.value })}
                  required
                >
                  <option value="">Select candidate</option>
                  {candidates?.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.first_name} {candidate.last_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Interaction Type</label>
                <select
                  value={formData.interaction_type}
                  onChange={(e) => setFormData({ ...formData, interaction_type: e.target.value })}
                  required
                >
                  <option value="call">Call</option>
                  <option value="email">Email</option>
                  <option value="meeting">Meeting</option>
                  <option value="note">Note</option>
                </select>
              </div>
              <div className="form-group">
                <label>Date</label>
                <input
                  type="date"
                  value={formData.interaction_date}
                  onChange={(e) => setFormData({ ...formData, interaction_date: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Follow-up Date (Optional)</label>
                <input
                  type="date"
                  value={formData.follow_up_date}
                  onChange={(e) => setFormData({ ...formData, follow_up_date: e.target.value })}
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={createMutation.isLoading}>
                  {createMutation.isLoading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CRM;


