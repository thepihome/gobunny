import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../config/api';
import { useAuth } from '../context/AuthContext';
import { FiPlus, FiCheck, FiX } from 'react-icons/fi';
import { useResizableColumns } from '../hooks/useResizableColumns';
import './Timesheets.css';

const Timesheets = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    candidate_id: '',
    job_id: '',
    date: new Date().toISOString().split('T')[0],
    hours: '',
    description: '',
  });

  const { data: timesheets, isLoading } = useQuery(
    'timesheets',
    () => api.get('/timesheets').then(res => res.data)
  );

  const { data: candidates } = useQuery(
    'assigned-candidates',
    () => api.get('/candidates/assigned').then(res => res.data),
    { enabled: user?.role === 'consultant' }
  );

  const { data: jobs } = useQuery(
    'jobs',
    () => api.get('/jobs').then(res => res.data),
    { enabled: user?.role === 'consultant' }
  );

  const createMutation = useMutation(
    (data) => api.post('/timesheets', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('timesheets');
        setShowModal(false);
        setFormData({
          candidate_id: '',
          job_id: '',
          date: new Date().toISOString().split('T')[0],
          hours: '',
          description: '',
        });
      },
    }
  );

  const submitMutation = useMutation(
    (id) => api.post(`/timesheets/${id}/submit`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('timesheets');
      },
    }
  );

  const approveMutation = useMutation(
    ({ id, action }) => api.post(`/timesheets/${id}/approve`, { action }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('timesheets');
      },
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  // Resizable columns hook (8 columns for admin, 7 for consultant: Date, Hours, Description, User (admin only), Candidate, Job, Status, Actions)
  const initialWidths = user?.role === 'admin' 
    ? [120, 80, 300, 150, 150, 150, 100, 120] 
    : [120, 80, 300, 150, 150, 100, 120];
  const { getColumnProps, ResizeHandle, tableRef } = useResizableColumns(
    initialWidths,
    `timesheets-column-widths-${user?.role || 'default'}`
  );

  if (isLoading) {
    return <div className="loading">Loading timesheets...</div>;
  }

  return (
    <div className="timesheets-page">
      <div className="page-header">
        <h1>Timesheets</h1>
        {user?.role === 'consultant' && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <FiPlus /> New Timesheet
          </button>
        )}
      </div>

      <table ref={tableRef} className="table" style={{ tableLayout: 'fixed', width: '100%' }}>
        <thead>
          <tr>
            <th {...getColumnProps(0)}>Date<ResizeHandle index={0} /></th>
            <th {...getColumnProps(1)}>Hours<ResizeHandle index={1} /></th>
            <th {...getColumnProps(2)}>Description<ResizeHandle index={2} /></th>
            {user?.role === 'admin' && <th {...getColumnProps(3)}>User<ResizeHandle index={3} /></th>}
            <th {...getColumnProps(user?.role === 'admin' ? 4 : 3)}>Candidate<ResizeHandle index={user?.role === 'admin' ? 4 : 3} /></th>
            <th {...getColumnProps(user?.role === 'admin' ? 5 : 4)}>Job<ResizeHandle index={user?.role === 'admin' ? 5 : 4} /></th>
            <th {...getColumnProps(user?.role === 'admin' ? 6 : 5)}>Status<ResizeHandle index={user?.role === 'admin' ? 6 : 5} /></th>
            <th {...getColumnProps(user?.role === 'admin' ? 7 : 6)}>Actions<ResizeHandle index={user?.role === 'admin' ? 7 : 6} /></th>
          </tr>
        </thead>
        <tbody>
          {timesheets && timesheets.length > 0 ? (
            timesheets.map((timesheet) => (
              <tr key={timesheet.id}>
                <td>{new Date(timesheet.date).toLocaleDateString()}</td>
                <td>{timesheet.hours}</td>
                <td>{timesheet.description}</td>
                {user?.role === 'admin' && (
                  <td>{timesheet.user_email}</td>
                )}
                <td>
                  {timesheet.candidate_first_name && timesheet.candidate_last_name
                    ? `${timesheet.candidate_first_name} ${timesheet.candidate_last_name}`
                    : 'N/A'}
                </td>
                <td>{timesheet.job_title || 'N/A'}</td>
                <td>
                  <span className={`badge badge-${timesheet.status === 'approved' ? 'success' : timesheet.status === 'rejected' ? 'danger' : 'warning'}`}>
                    {timesheet.status}
                  </span>
                </td>
                <td>
                  {user?.role === 'consultant' && timesheet.status === 'draft' && (
                    <button
                      onClick={() => submitMutation.mutate(timesheet.id)}
                      className="btn btn-success btn-sm"
                    >
                      <FiCheck /> Submit
                    </button>
                  )}
                  {user?.role === 'admin' && timesheet.status === 'submitted' && (
                    <>
                      <button
                        onClick={() => approveMutation.mutate({ id: timesheet.id, action: 'approve' })}
                        className="btn btn-success btn-sm"
                      >
                        <FiCheck /> Approve
                      </button>
                      <button
                        onClick={() => approveMutation.mutate({ id: timesheet.id, action: 'reject' })}
                        className="btn btn-danger btn-sm"
                      >
                        <FiX /> Reject
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="8" className="empty-state">No timesheets found</td>
            </tr>
          )}
        </tbody>
      </table>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>New Timesheet</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Hours</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={formData.hours}
                  onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Candidate (Optional)</label>
                <select
                  value={formData.candidate_id}
                  onChange={(e) => setFormData({ ...formData, candidate_id: e.target.value })}
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
                <label>Job (Optional)</label>
                <select
                  value={formData.job_id}
                  onChange={(e) => setFormData({ ...formData, job_id: e.target.value })}
                >
                  <option value="">Select job</option>
                  {jobs?.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title} - {job.company}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
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

export default Timesheets;


