import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../config/api';
import { useAuth } from '../context/AuthContext';
import {
  FiMapPin,
  FiDollarSign,
  FiExternalLink,
  FiRefreshCw,
  FiEdit,
  FiTrash2,
  FiZap,
  FiUser,
  FiAward,
  FiArrowLeft,
} from 'react-icons/fi';
import './JobDetails.css';
import '../pages/Jobs.css';
import LoadingButton, { iconSpinClass } from '../components/LoadingButton';
import IconButton from '../components/IconButton';
import JobFormModal from '../components/JobFormModal';
import { listingTypeLabel, listingTypeBadgeClass } from '../utils/listingType';

const TOP_SUGGESTIONS_LIMIT = 5;

function getScoreBadgeTone(score) {
  const n = Number(score);
  if (n >= 80) return 'success';
  if (n >= 60) return 'info';
  if (n >= 40) return 'warning';
  return 'danger';
}

const JobDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedResume, setSelectedResume] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);

  const isStaff = user?.role === 'consultant' || user?.role === 'admin';

  const { data: job, isLoading } = useQuery(
    ['job', id],
    () => api.get(`/jobs/${id}`).then((res) => res.data)
  );

  const { data: jobMatches = [], isLoading: loadingSuggestions } = useQuery(
    ['job-matches', id],
    () => api.get(`/matches/job/${id}`).then((res) => res.data),
    { enabled: isStaff && Boolean(id) }
  );

  const topSuggestions = jobMatches.slice(0, TOP_SUGGESTIONS_LIMIT);

  const { data: resumes } = useQuery(
    'my-resumes',
    () => api.get('/resumes/my-resumes').then((res) => res.data),
    { enabled: user?.role === 'candidate' }
  );

  const matchMutation = useMutation(
    ({ resume_id, job_id }) => api.post('/matches/match', { resume_id, job_id }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('all-matches');
        queryClient.invalidateQueries('jobs-with-matches');
        queryClient.invalidateQueries('matches');
        alert('Resume matched successfully!');
      },
      onError: (error) => {
        alert(error.response?.data?.error || 'Failed to match resume');
      },
    }
  );

  const deleteJobMutation = useMutation(
    () => api.delete(`/jobs/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('jobs');
        navigate('/jobs');
      },
      onError: (error) => {
        alert(error.response?.data?.error || 'Failed to delete job');
      },
    }
  );

  const aiMatchJobMutation = useMutation(
    () => api.post(`/matches/ai-recompute-job/${id}`),
    {
      onSuccess: (res) => {
        queryClient.invalidateQueries('jobs');
        queryClient.invalidateQueries(['job', id]);
        queryClient.invalidateQueries(['job-matches', id]);
        queryClient.invalidateQueries('all-matches');
        window.alert(
          `AI matching finished: ${res.data.upserted} pairs saved, ${res.data.below_threshold_removed} below threshold removed.`
        );
      },
      onError: (e) => window.alert(e.response?.data?.error || e.message),
    }
  );

  const handleMatch = () => {
    if (!selectedResume) {
      alert('Please select a resume');
      return;
    }
    matchMutation.mutate({ resume_id: selectedResume, job_id: id });
  };

  const handleDelete = () => {
    if (!job) return;
    if (window.confirm(`Are you sure you want to delete "${job.title}"? This will soft delete the job.`)) {
      deleteJobMutation.mutate();
    }
  };

  const handleAiMatch = () => {
    if (!job) return;
    if (window.confirm(`Run AI matching for "${job.title}"?`)) {
      aiMatchJobMutation.mutate();
    }
  };

  if (isLoading) {
    return <div className="loading">Loading job details...</div>;
  }

  if (!job) {
    return <div className="error">Job not found</div>;
  }

  return (
    <div className="job-details list-page">
      <div className="job-details-toolbar page-toolbar">
        <IconButton icon={FiArrowLeft} label="Back to jobs" onClick={() => navigate('/jobs')} />
      </div>

      <div className="job-details-card">
        <div className="job-details-header">
          <h1>{job.title}</h1>
          <div className="list-page-header-actions job-details-actions">
            {user?.role === 'candidate' && job.match_score != null && (
              <span className="badge badge-info">Match {Math.round(Number(job.match_score))}%</span>
            )}
            <span className={`badge badge-${job.status === 'active' ? 'success' : job.status === 'closed' ? 'warning' : job.status === 'draft' ? 'info' : 'danger'}`}>
              {job.status}
            </span>
            {isStaff && (
              <span className={`badge badge-${listingTypeBadgeClass(job.listing_type)}`}>
                {listingTypeLabel(job.listing_type)}
              </span>
            )}
            {isStaff && (
              <>
                <IconButton
                  icon={FiZap}
                  label="AI match candidates"
                  size="sm"
                  onClick={handleAiMatch}
                  disabled={aiMatchJobMutation.isLoading}
                  loading={aiMatchJobMutation.isLoading}
                />
                <IconButton
                  icon={FiEdit}
                  label="Edit job"
                  size="sm"
                  onClick={() => setShowEditModal(true)}
                />
                <IconButton
                  icon={FiTrash2}
                  label="Delete job"
                  variant="danger"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleteJobMutation.isLoading}
                  loading={deleteJobMutation.isLoading}
                />
              </>
            )}
          </div>
        </div>

        <p className="job-company">{job.company}</p>
        {isStaff && job.listing_type === 'web' && (
          <p className="form-hint" style={{ marginTop: 8 }}>
            This job is published on the public career site API (<code>GET /api/careers/jobs</code>).
          </p>
        )}

        <div className="job-meta">
          {job.location && (
            <div className="meta-item">
              <FiMapPin /> {job.location}
            </div>
          )}
          {(job.salary_min || job.salary_max) && (
            <div className="meta-item">
              <FiDollarSign /> {job.salary_min && job.salary_max
                ? `$${job.salary_min.toLocaleString()} - $${job.salary_max.toLocaleString()}`
                : job.salary_min
                ? `$${job.salary_min.toLocaleString()}+`
                : `Up to $${job.salary_max.toLocaleString()}`}
            </div>
          )}
          {job.employment_type && (
            <div className="meta-item">{job.employment_type}</div>
          )}
          {job.experience_level && (
            <div className="meta-item">Experience: {job.experience_level}</div>
          )}
        </div>

        <div className="job-section">
          <h2>Description</h2>
          <p>{job.description || 'No description provided.'}</p>
        </div>

        {job.required_skills && job.required_skills.length > 0 && (
          <div className="job-section">
            <h2>Required Skills</h2>
            <div className="skills-list">
              {job.required_skills.map((skill, idx) => (
                <span key={idx} className="skill-tag">{skill}</span>
              ))}
            </div>
          </div>
        )}

        {job.preferred_skills && job.preferred_skills.length > 0 && (
          <div className="job-section">
            <h2>Preferred Skills</h2>
            <div className="skills-list">
              {job.preferred_skills.map((skill, idx) => (
                <span key={idx} className="skill-tag skill-tag-secondary">{skill}</span>
              ))}
            </div>
          </div>
        )}

        {job.external_apply_link && (
          <div className="job-section">
            <h2>Apply for this Position</h2>
            <a
              href={job.external_apply_link}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary external-apply-btn"
            >
              <FiExternalLink /> Apply externally
            </a>
            <p className="external-link-hint">This will open the company's application page in a new tab.</p>
          </div>
        )}

        {user?.role === 'candidate' && resumes && resumes.length > 0 && (
          <div className="job-section">
            <h2>Prepare your application</h2>
            <p className="external-link-hint">
              Score this role against your resume in Resume Studio before you apply — see keyword gaps and tailoring tips.
            </p>
            <Link
              to={`/resumes/${resumes[0].id}/studio?job_id=${id}`}
              className="btn btn-primary"
              style={{ marginRight: '0.5rem' }}
            >
              <FiRefreshCw /> Score in Resume Studio
            </Link>
          </div>
        )}

        {user?.role === 'candidate' && resumes && resumes.length > 0 && (
          <div className="job-section">
            <h2>Match your resume</h2>
            <div className="match-resume-panel">
              <div className="match-resume">
                <div className="match-resume-select-wrap">
                  <label htmlFor="job-detail-resume">Resume</label>
                  <select
                    id="job-detail-resume"
                    value={selectedResume}
                    onChange={(e) => setSelectedResume(e.target.value)}
                  >
                    <option value="">Select a resume</option>
                    {resumes.map((resume) => (
                      <option key={resume.id} value={resume.id}>
                        {resume.file_name || `Resume ${resume.id}`}
                      </option>
                    ))}
                  </select>
                </div>
                <LoadingButton
                  className="btn btn-primary"
                  icon={FiRefreshCw}
                  loading={matchMutation.isLoading}
                  loadingLabel="Matching…"
                  onClick={handleMatch}
                >
                  Match resume
                </LoadingButton>
              </div>
            </div>
          </div>
        )}
      </div>

      {isStaff && (
        <div className="job-details-card job-suggested-candidates">
          <div className="job-suggested-header">
            <div>
              <h2>
                <FiAward aria-hidden /> Top candidate suggestions
              </h2>
              <p className="job-suggested-subtitle">
                Highest-ranked matches for this role based on stored match scores.
              </p>
            </div>
            {jobMatches.length > TOP_SUGGESTIONS_LIMIT && (
              <Link to="/matches" className="btn btn-secondary btn-sm">
                View all {jobMatches.length} matches
              </Link>
            )}
          </div>

          {loadingSuggestions ? (
            <p className="job-suggested-empty">Loading suggestions…</p>
          ) : topSuggestions.length > 0 ? (
            <ol className="job-suggested-list">
              {topSuggestions.map((match, index) => (
                <li key={match.id} className="job-suggested-item">
                  <span className={`job-suggested-rank${index < 3 ? ` job-suggested-rank--${index + 1}` : ''}`}>
                    #{index + 1}
                  </span>
                  <div className="job-suggested-body">
                    <div className="job-suggested-top">
                      <div className="job-suggested-identity">
                        <FiUser aria-hidden className="job-suggested-icon" />
                        <div>
                          <strong>
                            {match.first_name} {match.last_name}
                          </strong>
                          <span className="job-suggested-email">{match.email}</span>
                        </div>
                      </div>
                      <span className={`badge badge-${getScoreBadgeTone(match.match_score)}`}>
                        {Math.round(Number(match.match_score))}% match
                      </span>
                    </div>
                    <div className="job-suggested-meta">
                      {match.current_job_title && (
                        <span>{match.current_job_title}</span>
                      )}
                      {match.job_classification_name && (
                        <span className="job-suggested-classification">
                          {match.current_job_title ? ' · ' : ''}
                          {match.job_classification_name}
                        </span>
                      )}
                      {match.status && match.status !== 'pending' && (
                        <span className={`badge badge-info job-suggested-status`}>{match.status}</span>
                      )}
                    </div>
                    {match.notes && (
                      <p className="job-suggested-notes">{match.notes}</p>
                    )}
                  </div>
                  <Link
                    to={`/candidates/${match.candidate_id}`}
                    className="btn btn-secondary btn-sm job-suggested-profile-btn"
                  >
                    View profile
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <div className="job-suggested-empty-state">
              <p>No ranked candidates yet for this job.</p>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleAiMatch}
                disabled={aiMatchJobMutation.isLoading}
              >
                <FiZap className={iconSpinClass(aiMatchJobMutation.isLoading)} />
                Run AI match
              </button>
            </div>
          )}
        </div>
      )}

      {isStaff && (
        <JobFormModal
          open={showEditModal}
          onClose={() => setShowEditModal(false)}
          job={job}
        />
      )}
    </div>
  );
};

export default JobDetails;
