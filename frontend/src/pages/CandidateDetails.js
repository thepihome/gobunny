import React, { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api, { openAuthenticatedFile } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { FiEdit, FiSave, FiX, FiClock, FiSearch, FiFilter, FiChevronDown, FiChevronUp, FiUserPlus, FiUserMinus, FiDatabase, FiPlus, FiActivity, FiMail, FiPhone, FiArrowLeft } from 'react-icons/fi';
import './CandidateDetails.css';
import './CRM.css';
import LoadingButton, { iconSpinClass } from '../components/LoadingButton';
import CrmTimeline, { crmIsFollowUpOverdue } from '../components/CrmTimeline';
import CrmInteractionModal from '../components/CrmInteractionModal';
import IconButton from '../components/IconButton';
import Modal from '../components/Modal';
import { isActiveStatus } from '../utils/activeStatus';

function parseStringArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function hasProfileContent(profile) {
  if (!profile || typeof profile !== 'object') return false;
  const fields = [
    'date_of_birth', 'years_of_experience', 'address', 'city', 'state', 'country',
    'zip_code', 'current_job_title', 'job_classification_name', 'current_company',
    'availability', 'linkedin_url', 'portfolio_url', 'github_url',
    'expected_salary_min', 'expected_salary_max', 'work_authorization',
    'summary', 'additional_notes',
  ];
  if (fields.some((field) => profile[field])) return true;
  if (profile.willing_to_relocate) return true;
  return parseStringArray(profile.preferred_locations).length > 0;
}

const LOG_ACTION_FILTERS = [
  { value: '', label: 'All', tone: 'neutral' },
  { value: 'create', label: 'Create', tone: 'create' },
  { value: 'update', label: 'Update', tone: 'update' },
  { value: 'delete', label: 'Delete', tone: 'delete' },
  { value: 'view', label: 'View', tone: 'view' },
];

const KNOWN_LOG_ACTIONS = new Set(['create', 'update', 'delete', 'view']);

function logActionClass(action) {
  return KNOWN_LOG_ACTIONS.has(action) ? action : 'unknown';
}

const CandidateDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState({});
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [logSearch, setLogSearch] = useState('');
  const [logDateFrom, setLogDateFrom] = useState('');
  const [logDateTo, setLogDateTo] = useState('');
  const [logAction, setLogAction] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showLogCrmModal, setShowLogCrmModal] = useState(false);

  const { data: candidate, isLoading, isError, error } = useQuery(
    ['candidate', id],
    () => api.get(`/candidates/${id}`).then(res => res.data),
    {
      enabled: Boolean(id),
      onSuccess: (data) => {
        if (data?.profile) {
          setProfileData(data.profile);
        }
      }
    }
  );

  // Fetch job roles for dropdown
  const { data: jobRoles = [] } = useQuery(
    ['job-roles'],
    () => api.get('/job-roles').then(res => res.data),
    {
      enabled: isEditing
    }
  );

  // Fetch consultants for assignment (admin only)
  const { data: consultants = [] } = useQuery(
    ['consultants'],
    () => api.get('/users').then(res => res.data.filter(u => u.role === 'consultant' || u.role === 'admin')),
    {
      enabled: user?.role === 'admin'
    }
  );

  // Assignment state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedConsultant, setSelectedConsultant] = useState('');

  // Assign candidate mutation
  const assignMutation = useMutation(
    ({ consultantId }) => api.post(`/candidates/${id}/assign`, { consultant_id: consultantId }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['candidate', id]);
        setShowAssignModal(false);
        setSelectedConsultant('');
      },
    }
  );

  // Unassign candidate mutation
  const unassignMutation = useMutation(
    ({ consultantId }) => api.delete(`/candidates/${id}/assign/${consultantId}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['candidate', id]);
      },
    }
  );

  const handleAssignSubmit = (e) => {
    e.preventDefault();
    if (selectedConsultant) {
      assignMutation.mutate({
        consultantId: parseInt(selectedConsultant)
      });
    }
  };

  // Build activity logs query params
  const activityLogsParams = useMemo(() => {
    const params = new URLSearchParams();
    const profileId = candidate?.profile?.id;
    if (profileId) {
      params.append('entity_type', 'candidate_profile');
      params.append('entity_id', profileId);
    }
    params.append('limit', showAllLogs ? '100' : '5');
    if (logSearch) params.append('search', logSearch);
    if (logDateFrom) params.append('date_from', logDateFrom);
    if (logDateTo) params.append('date_to', logDateTo);
    if (logAction) params.append('action', logAction);
    return params.toString();
  }, [candidate?.profile?.id, showAllLogs, logSearch, logDateFrom, logDateTo, logAction]);

  // Fetch activity logs
  const { data: activityLogs, isLoading: isLoadingLogs } = useQuery(
    ['activity-logs', 'candidate_profile', candidate?.profile?.id, activityLogsParams],
    () =>
      api.get(`/activity-logs?${activityLogsParams}`)
        .then(res => (Array.isArray(res.data) ? res.data : []))
        .catch(() => []),
    {
      enabled: !!candidate?.profile?.id && (user?.role === 'consultant' || user?.role === 'admin'),
      refetchOnWindowFocus: false,
    }
  );

  const handleClearFilters = () => {
    setLogSearch('');
    setLogDateFrom('');
    setLogDateTo('');
    setLogAction('');
  };

  const hasActiveFilters = logSearch || logDateFrom || logDateTo || logAction;

  const updateProfileMutation = useMutation(
    (data) => api.post('/candidate-profiles', { user_id: parseInt(id), ...data }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['candidate', id]);
        queryClient.invalidateQueries(['activity-logs']);
        setIsEditing(false);
      }
    }
  );

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setProfileData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleArrayChange = (name, value) => {
    setProfileData(prev => ({
      ...prev,
      [name]: value.split(',').map(item => item.trim()).filter(item => item)
    }));
  };

  const handleSave = () => {
    updateProfileMutation.mutate(profileData);
  };

  const handleCancel = () => {
    if (candidate?.profile) {
      setProfileData(candidate.profile);
    }
    setIsEditing(false);
  };

  if (!id) {
    return <div className="error">Invalid candidate ID</div>;
  }

  if (isLoading) {
    return <div className="loading">Loading candidate details...</div>;
  }

  if (isError) {
    const message = error?.response?.data?.error || error?.message || 'Failed to load candidate profile';
    return (
      <div className="candidate-details list-page">
        <div className="candidate-details-toolbar">
          <IconButton icon={FiArrowLeft} label="Back to candidates" onClick={() => navigate('/candidates')} />
        </div>
        <div className="candidate-details-card">
          <div className="error">{message}</div>
          <Link to="/candidates" className="btn btn-secondary" style={{ marginTop: '1rem' }}>
            Back to Candidates
          </Link>
        </div>
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="candidate-details list-page">
        <div className="candidate-details-toolbar">
          <IconButton icon={FiArrowLeft} label="Back to candidates" onClick={() => navigate('/candidates')} />
        </div>
        <div className="candidate-details-card">
          <div className="error">Candidate not found</div>
        </div>
      </div>
    );
  }

  const profile = candidate.profile || {};
  const canEdit = user?.role === 'admin' || user?.role === 'consultant' || user?.id === parseInt(id);
  const canViewCrm = user?.role === 'consultant' || user?.role === 'admin';
  const crmInteractions = candidate.crm_interactions || [];
  const crmOpenCount = crmInteractions.filter((i) =>
    ['open', 'pending', 'scheduled'].includes(i.status)
  ).length;
  const crmOverdueCount = crmInteractions.filter(crmIsFollowUpOverdue).length;
  const crmLastContact = crmInteractions[0]?.interaction_date;
  const crmNextFollowUp = crmInteractions
    .filter((i) => i.follow_up_date && !['completed', 'cancelled'].includes(i.status))
    .map((i) => ({ date: new Date(i.follow_up_date), id: i.id }))
    .sort((a, b) => a.date - b.date)[0];

  return (
    <div className="candidate-details list-page">
      <div className="candidate-details-toolbar page-toolbar">
        <IconButton
          icon={FiArrowLeft}
          label="Back to candidates"
          onClick={() => navigate('/candidates')}
        />
      </div>

      <div className="candidate-details-card candidate-details-hero">
        <div className="candidate-details-header">
          <div className="candidate-details-identity">
            <h1>{candidate.first_name} {candidate.last_name}</h1>
            <div className="candidate-details-contact">
              <span className="candidate-details-contact-item">
                <FiMail aria-hidden /> {candidate.email}
              </span>
              {candidate.phone && (
                <span className="candidate-details-contact-item">
                  <FiPhone aria-hidden /> {candidate.phone}
                </span>
              )}
            </div>
          </div>
          <div className="list-page-header-actions candidate-details-actions">
            <span className={`badge badge-${isActiveStatus(candidate.is_active) ? 'success' : 'danger'}`}>
              {isActiveStatus(candidate.is_active) ? 'Active' : 'Inactive'}
            </span>
            {canEdit && !isEditing && (
              <IconButton
                icon={FiEdit}
                label="Edit profile"
                variant="primary"
                size="sm"
                onClick={() => setIsEditing(true)}
              />
            )}
          </div>
        </div>

        {user?.role === 'admin' && (
          <div className="candidate-assignment-panel">
            <p className="candidate-assignment-label"><strong>Consultant assignment</strong></p>
            {candidate.consultant ? (
              <div className="candidate-assignment-row">
                <span>
                  {candidate.consultant.first_name} {candidate.consultant.last_name} ({candidate.consultant.email})
                </span>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    if (window.confirm(`Unassign ${candidate.consultant.first_name} ${candidate.consultant.last_name} from this candidate?`)) {
                      unassignMutation.mutate({ consultantId: candidate.consultant.id });
                    }
                  }}
                  disabled={unassignMutation.isLoading}
                >
                  <FiUserMinus className={iconSpinClass(unassignMutation.isLoading)} /> {unassignMutation.isLoading ? 'Unassigning…' : 'Unassign'}
                </button>
              </div>
            ) : (
              <div className="candidate-assignment-row">
                <span className="text-muted">Not assigned</span>
                <LoadingButton
                  className="btn btn-success btn-sm"
                  icon={FiUserPlus}
                  onClick={() => setShowAssignModal(true)}
                >
                  Assign Consultant
                </LoadingButton>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="candidate-section candidate-details-card">
        <div className="section-header">
          <h2>Profile Information</h2>
          {isEditing && (
            <div className="edit-actions">
              <LoadingButton
                className="btn btn-success"
                icon={FiSave}
                loading={updateProfileMutation.isLoading}
                loadingLabel="Saving..."
                onClick={handleSave}
              >
                Save
              </LoadingButton>
              <button className="btn btn-secondary" onClick={handleCancel}>
                <FiX /> Cancel
              </button>
            </div>
          )}
        </div>

        {isEditing ? (
          <div className="profile-edit-form">
            <div className="form-row">
              <div className="form-group">
                <label>Date of Birth</label>
                <input
                  type="date"
                  name="date_of_birth"
                  value={profileData.date_of_birth || ''}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Years of Experience</label>
                <input
                  type="number"
                  name="years_of_experience"
                  value={profileData.years_of_experience || ''}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Address</label>
              <input
                type="text"
                name="address"
                value={profileData.address || ''}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>City</label>
                <input
                  type="text"
                  name="city"
                  value={profileData.city || ''}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>State</label>
                <input
                  type="text"
                  name="state"
                  value={profileData.state || ''}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Country</label>
                <input
                  type="text"
                  name="country"
                  value={profileData.country || ''}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Zip Code</label>
                <input
                  type="text"
                  name="zip_code"
                  value={profileData.zip_code || ''}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Job Classification</label>
                <select
                  name="job_classification"
                  value={profileData.job_classification || ''}
                  onChange={handleInputChange}
                >
                  <option value="">Select a job classification</option>
                  {jobRoles
                    .filter(role => role.is_active === 1 || role.is_active === true)
                    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
                    .map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="form-group">
                <label>Job Title</label>
                <input
                  type="text"
                  name="current_job_title"
                  value={profileData.current_job_title || ''}
                  onChange={handleInputChange}
                  placeholder="e.g., Senior Software Engineer"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Current Company</label>
                <input
                  type="text"
                  name="current_company"
                  value={profileData.current_company || ''}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>LinkedIn URL</label>
                <input
                  type="url"
                  name="linkedin_url"
                  value={profileData.linkedin_url || ''}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Portfolio URL</label>
                <input
                  type="url"
                  name="portfolio_url"
                  value={profileData.portfolio_url || ''}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>GitHub URL</label>
                <input
                  type="url"
                  name="github_url"
                  value={profileData.github_url || ''}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Availability</label>
                <select
                  name="availability"
                  value={profileData.availability || ''}
                  onChange={handleInputChange}
                >
                  <option value="">Select availability</option>
                  <option value="available">Available</option>
                  <option value="not-available">Not Available</option>
                  <option value="available-soon">Available Soon</option>
                  <option value="contract-only">Contract Only</option>
                </select>
              </div>
              <div className="form-group">
                <label>Work Authorization</label>
                <input
                  type="text"
                  name="work_authorization"
                  value={profileData.work_authorization || ''}
                  onChange={handleInputChange}
                  placeholder="e.g., US Citizen, H1B, etc."
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Expected Salary Min</label>
                <input
                  type="number"
                  name="expected_salary_min"
                  value={profileData.expected_salary_min || ''}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Expected Salary Max</label>
                <input
                  type="number"
                  name="expected_salary_max"
                  value={profileData.expected_salary_max || ''}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  name="willing_to_relocate"
                  checked={profileData.willing_to_relocate || false}
                  onChange={handleInputChange}
                />
                Willing to Relocate
              </label>
            </div>

            <div className="form-group">
              <label>Preferred Locations (comma-separated)</label>
              <input
                type="text"
                name="preferred_locations"
                value={Array.isArray(profileData.preferred_locations) 
                  ? profileData.preferred_locations.join(', ') 
                  : (profileData.preferred_locations || '')}
                onChange={(e) => handleArrayChange('preferred_locations', e.target.value)}
                placeholder="e.g., San Francisco, New York, Remote"
              />
            </div>

            <div className="form-group">
              <label>Professional Summary</label>
              <textarea
                name="summary"
                value={profileData.summary || ''}
                onChange={handleInputChange}
                rows={5}
              />
            </div>

            <div className="form-group">
              <label>Additional Notes</label>
              <textarea
                name="additional_notes"
                value={profileData.additional_notes || ''}
                onChange={handleInputChange}
                rows={3}
              />
            </div>
          </div>
        ) : (
          <div className="profile-grid">
            {!hasProfileContent(profile) && (
              <p className="profile-empty-state">
                No profile information yet.
                {canEdit ? ' Click Edit Profile to add details.' : ''}
              </p>
            )}
            {profile.date_of_birth && (
              <div className="profile-item">
                <strong>Date of Birth:</strong> {new Date(profile.date_of_birth).toLocaleDateString()}
              </div>
            )}
            {profile.years_of_experience && (
              <div className="profile-item">
                <strong>Experience:</strong> {profile.years_of_experience} years
              </div>
            )}
            {(profile.address || profile.city || profile.state || profile.country) && (
              <div className="profile-item">
                <strong>Address:</strong> {[profile.address, profile.city, profile.state, profile.country, profile.zip_code].filter(Boolean).join(', ')}
              </div>
            )}
            {(profile.current_job_title || profile.job_classification_name) && (
              <div className="profile-item">
                <strong>Current Position:</strong> {profile.current_job_title || profile.job_classification_name} {profile.current_company && `at ${profile.current_company}`}
              </div>
            )}
            {profile.availability && (
              <div className="profile-item">
                <strong>Availability:</strong> {profile.availability.replace('-', ' ')}
              </div>
            )}
            {profile.linkedin_url && (
              <div className="profile-item">
                <strong>LinkedIn:</strong> <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer">{profile.linkedin_url}</a>
              </div>
            )}
            {profile.portfolio_url && (
              <div className="profile-item">
                <strong>Portfolio:</strong> <a href={profile.portfolio_url} target="_blank" rel="noopener noreferrer">{profile.portfolio_url}</a>
              </div>
            )}
            {profile.github_url && (
              <div className="profile-item">
                <strong>GitHub:</strong> <a href={profile.github_url} target="_blank" rel="noopener noreferrer">{profile.github_url}</a>
              </div>
            )}
            {(profile.expected_salary_min || profile.expected_salary_max) && (
              <div className="profile-item">
                <strong>Expected Salary:</strong> ${profile.expected_salary_min || 'N/A'} - ${profile.expected_salary_max || 'N/A'}
              </div>
            )}
            {profile.work_authorization && (
              <div className="profile-item">
                <strong>Work Authorization:</strong> {profile.work_authorization}
              </div>
            )}
            {hasProfileContent(profile) && (
            <div className="profile-item">
              <strong>Willing to Relocate:</strong> {profile.willing_to_relocate ? 'Yes' : 'No'}
            </div>
            )}
            {profile.preferred_locations && parseStringArray(profile.preferred_locations).length > 0 && (
              <div className="profile-item">
                <strong>Preferred Locations:</strong> {parseStringArray(profile.preferred_locations).join(', ')}
              </div>
            )}
            {profile.summary && (
              <div className="profile-item full-width">
                <strong>Professional Summary:</strong>
                <p>{profile.summary}</p>
              </div>
            )}
            {profile.additional_notes && (
              <div className="profile-item full-width">
                <strong>Additional Notes:</strong>
                <p>{profile.additional_notes}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="candidate-section candidate-details-card">
        <h2>Resumes ({candidate.resumes ? candidate.resumes.length : 0}/3)</h2>
        {candidate.resumes && candidate.resumes.length > 0 ? (
          <div className="resumes-list">
            {candidate.resumes.map((resume) => {
              const skills = parseStringArray(resume.skills);
              return (
              <div key={resume.id} className="resume-item">
                <div className="resume-item-header">
                  <h4>{resume.file_name || `Resume ${resume.id}`}</h4>
                  <span className="resume-meta">
                    {resume.file_size && (
                      <span>{(resume.file_size / 1024).toFixed(2)} KB</span>
                    )}
                    {resume.uploaded_at && (
                      <span> • Uploaded: {new Date(resume.uploaded_at).toLocaleDateString()}</span>
                    )}
                  </span>
                </div>
                {skills.length > 0 && (
                  <div className="skills-list">
                    <strong>Skills:</strong>
                    {skills.map((skill, idx) => (
                      <span key={idx} className="skill-tag">{skill}</span>
                    ))}
                  </div>
                )}
                {resume.experience_years && (
                  <p><strong>Experience:</strong> {resume.experience_years} years</p>
                )}
                {resume.education && (
                  <p><strong>Education:</strong> {resume.education}</p>
                )}
                {resume.summary && (
                  <p><strong>Summary:</strong> {resume.summary}</p>
                )}
                {resume.file_path && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ marginTop: '10px', display: 'inline-block' }}
                    onClick={async () => {
                      try {
                        await openAuthenticatedFile(`/resumes/${resume.id}/download`);
                      } catch {
                        alert('Failed to download resume');
                      }
                    }}
                  >
                    View Resume
                  </button>
                )}
              </div>
            );
            })}
          </div>
        ) : (
          <p>No resumes uploaded</p>
        )}
      </div>

      <div className="candidate-section candidate-details-card">
        <h2>Job Matches</h2>
        {candidate.matches && candidate.matches.length > 0 ? (
          <div className="matches-list">
            {candidate.matches.map((match) => (
              <div key={match.id} className="match-item">
                <h4>{match.title}</h4>
                <p>Company: {match.company}</p>
                <p>Match Score: <strong>{match.match_score}%</strong></p>
                <p>Status: <span className="badge badge-info">{match.status}</span></p>
              </div>
            ))}
          </div>
        ) : (
          <p>No matches yet</p>
        )}
      </div>

      <div className="candidate-section candidate-section-crm candidate-details-card">
        <div className="candidate-section-crm-header">
          <h2>
            <FiActivity aria-hidden /> CRM activity
          </h2>
          {canViewCrm && (
            <div className="candidate-crm-header-actions page-toolbar">
              <IconButton
                icon={FiPlus}
                label="Log interaction"
                variant="primary"
                size="sm"
                onClick={() => setShowLogCrmModal(true)}
              />
              <Link
                to={`/crm?candidate=${id}`}
                className="btn btn-icon btn-icon-sm btn-secondary"
                title="Open CRM"
                aria-label="Open CRM"
              >
                <FiDatabase aria-hidden />
              </Link>
            </div>
          )}
        </div>

        {crmInteractions.length > 0 ? (
          <>
            <div className="candidate-crm-summary">
              <div className="candidate-crm-summary__stat">
                <span className="candidate-crm-summary__label">Total</span>
                <strong>{crmInteractions.length}</strong>
              </div>
              <div className="candidate-crm-summary__stat">
                <span className="candidate-crm-summary__label">Open</span>
                <strong>{crmOpenCount}</strong>
              </div>
              {crmOverdueCount > 0 && (
                <div className="candidate-crm-summary__stat candidate-crm-summary__stat--warn">
                  <span className="candidate-crm-summary__label">Overdue follow-ups</span>
                  <strong>{crmOverdueCount}</strong>
                </div>
              )}
              {crmLastContact && (
                <div className="candidate-crm-summary__stat">
                  <span className="candidate-crm-summary__label">Last contact</span>
                  <strong>
                    {new Date(crmLastContact).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </strong>
                </div>
              )}
              {crmNextFollowUp && (
                <div className={`candidate-crm-summary__stat${crmIsFollowUpOverdue(crmInteractions.find((i) => i.id === crmNextFollowUp.id)) ? ' candidate-crm-summary__stat--warn' : ''}`}>
                  <span className="candidate-crm-summary__label">Next follow-up</span>
                  <strong>
                    {crmNextFollowUp.date.toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </strong>
                </div>
              )}
            </div>

            <CrmTimeline
              items={crmInteractions}
              showCandidateName={false}
              showConsultant
            />
          </>
        ) : (
          <div className="candidate-crm-empty-state">
            <p className="candidate-crm-empty">No CRM interactions for this candidate yet.</p>
            {canViewCrm && (
              <IconButton
                icon={FiPlus}
                label="Log first interaction"
                size="sm"
                onClick={() => setShowLogCrmModal(true)}
              />
            )}
          </div>
        )}
      </div>

      {/* Activity History Section */}
      {(user?.role === 'consultant' || user?.role === 'admin') && (candidate?.profile?.id || candidate?.id) && (
        <div className="candidate-section candidate-details-card activity-history">
          <div className="activity-history-header">
            <h2>
              <FiClock /> Activity History
            </h2>
            <div className="activity-history-controls">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <FiFilter /> {showFilters ? 'Hide Filters' : 'Show Filters'}
              </button>
              {!showAllLogs && activityLogs && activityLogs.length >= 5 && (
                <button
                  className="btn btn-info btn-sm"
                  onClick={() => setShowAllLogs(true)}
                >
                  Show All <FiChevronDown />
                </button>
              )}
              {showAllLogs && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowAllLogs(false)}
                >
                  Show Less <FiChevronUp />
                </button>
              )}
            </div>
          </div>

          {/* Filters Section */}
          {showFilters && (
            <div className="activity-filters">
              <div className="filter-row">
                <div className="filter-group">
                  <label>
                    <FiSearch /> Search
                  </label>
                  <input
                    type="text"
                    placeholder="Search by description, field, or user..."
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    className="filter-input"
                  />
                </div>
                <div className="filter-group">
                  <label>Action Type</label>
                  <div className="activity-action-filters">
                    {LOG_ACTION_FILTERS.map(({ value, label, tone }) => (
                      <button
                        key={value || 'all'}
                        type="button"
                        className={`activity-filter-btn activity-filter-btn--${tone}${logAction === value ? ' active' : ''}`}
                        onClick={() => setLogAction(value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="filter-row">
                <div className="filter-group">
                  <label>Date From</label>
                  <input
                    type="date"
                    value={logDateFrom}
                    onChange={(e) => setLogDateFrom(e.target.value)}
                    className="filter-input"
                  />
                </div>
                <div className="filter-group">
                  <label>Date To</label>
                  <input
                    type="date"
                    value={logDateTo}
                    onChange={(e) => setLogDateTo(e.target.value)}
                    className="filter-input"
                  />
                </div>
                {hasActiveFilters && (
                  <div className="filter-group">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={handleClearFilters}
                      style={{ marginTop: '24px' }}
                    >
                      Clear Filters
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {isLoadingLogs ? (
            <p>Loading activity history...</p>
          ) : activityLogs && activityLogs.length > 0 ? (
            <>
              <div className="activity-stats">
                <span className="activity-count">
                  Showing {activityLogs.length} log{activityLogs.length !== 1 ? 's' : ''}
                  {hasActiveFilters && ' (filtered)'}
                </span>
              </div>
              <div className="activity-list">
                {activityLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`activity-item activity-item--${logActionClass(log.action)}`}
                  >
                    <div className="activity-header">
                      <div className="activity-action">
                        <span className={`activity-badge activity-${logActionClass(log.action)}`}>
                          {log.action}
                        </span>
                        {log.description && (
                          <span className="activity-description">{log.description}</span>
                        )}
                      </div>
                      <div className="activity-meta">
                        {log.user_name && (
                          <span className="activity-user">{log.user_name}</span>
                        )}
                        <span className="activity-time">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    {log.field_name && (
                      <div className="activity-change">
                        <strong>{log.field_name}:</strong>
                        <span className="change-old">{log.old_value || '(empty)'}</span>
                        <span className="change-arrow">→</span>
                        <span className="change-new">{log.new_value || '(empty)'}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {!showAllLogs && activityLogs.length === 5 && (
                <div className="activity-more-indicator">
                  <p>Showing 5 most recent logs. Use "Show All" to see more.</p>
                </div>
              )}
            </>
          ) : (
            <p>No activity history available{hasActiveFilters && ' (try adjusting your filters)'}</p>
          )}
        </div>
      )}

      <Modal
        open={showAssignModal && user?.role === 'admin'}
        onClose={() => {
          setShowAssignModal(false);
          setSelectedConsultant('');
        }}
        ariaLabel="Assign candidate to consultant"
      >
        <h2>Assign Candidate to Consultant</h2>
        <p className="form-hint">
          Assign <strong>{candidate.first_name} {candidate.last_name}</strong> to a consultant
        </p>
        <form onSubmit={handleAssignSubmit}>
              <div className="form-group">
                <label>Select Consultant</label>
                <select
                  value={selectedConsultant}
                  onChange={(e) => setSelectedConsultant(e.target.value)}
                  required
                >
                  <option value="">Choose a consultant...</option>
                  {consultants.map((consultant) => (
                    <option key={consultant.id} value={consultant.id}>
                      {consultant.first_name} {consultant.last_name} ({consultant.email}) - {consultant.role}
                    </option>
                  ))}
                </select>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedConsultant('');
                  }}
                >
                  Cancel
                </button>
                <LoadingButton
                  type="submit"
                  className="btn btn-success"
                  icon={FiUserPlus}
                  loading={assignMutation.isLoading}
                  loadingLabel="Assigning..."
                  disabled={!selectedConsultant}
                >
                  Assign
                </LoadingButton>
              </div>
            </form>
      </Modal>

      {canViewCrm && (
        <CrmInteractionModal
          open={showLogCrmModal}
          onClose={() => setShowLogCrmModal(false)}
          candidateId={id}
          lockCandidate
          candidateLabel={
            candidate
              ? `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim()
              : ''
          }
        />
      )}
    </div>
  );
};

export default CandidateDetails;
