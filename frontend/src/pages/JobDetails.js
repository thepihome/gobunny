import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../config/api';
import { useAuth } from '../context/AuthContext';
import { FiMapPin, FiDollarSign, FiExternalLink } from 'react-icons/fi';
import './JobDetails.css';

const JobDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedResume, setSelectedResume] = useState('');

  const { data: job, isLoading } = useQuery(
    ['job', id],
    () => api.get(`/jobs/${id}`).then(res => res.data)
  );

  const { data: resumes } = useQuery(
    'my-resumes',
    () => api.get('/resumes/my-resumes').then(res => res.data),
    { enabled: user?.role === 'candidate' }
  );

  const matchMutation = useMutation(
    ({ resume_id, job_id }) => api.post('/matches/match', { resume_id, job_id }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('matches');
        alert('Resume matched successfully!');
      },
    }
  );

  const handleMatch = () => {
    if (!selectedResume) {
      alert('Please select a resume');
      return;
    }
    matchMutation.mutate({ resume_id: selectedResume, job_id: id });
  };

  if (isLoading) {
    return <div className="loading">Loading job details...</div>;
  }

  if (!job) {
    return <div className="error">Job not found</div>;
  }

  return (
    <div className="job-details">
      <button onClick={() => navigate('/jobs')} className="btn btn-secondary">
        ← Back to Jobs
      </button>

      <div className="job-details-card">
        <div className="job-details-header">
          <h1>{job.title}</h1>
          <span className={`badge badge-${job.status === 'active' ? 'success' : 'warning'}`}>
            {job.status}
          </span>
        </div>

        <p className="job-company">{job.company}</p>

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
              <FiExternalLink /> Apply Externally
            </a>
            <p className="external-link-hint">This will open the company's application page in a new tab.</p>
          </div>
        )}

        {user?.role === 'candidate' && resumes && resumes.length > 0 && (
          <div className="job-section">
            <h2>Match Your Resume</h2>
            <div className="match-resume">
              <select
                value={selectedResume}
                onChange={(e) => setSelectedResume(e.target.value)}
                className="form-group"
              >
                <option value="">Select a resume</option>
                {resumes.map((resume) => (
                  <option key={resume.id} value={resume.id}>
                    {resume.file_name || `Resume ${resume.id}`}
                  </option>
                ))}
              </select>
              <button
                onClick={handleMatch}
                className="btn btn-primary"
                disabled={matchMutation.isLoading}
              >
                {matchMutation.isLoading ? 'Matching...' : 'Match Resume'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default JobDetails;

