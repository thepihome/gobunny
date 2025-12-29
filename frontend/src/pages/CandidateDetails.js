import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from 'react-query';
import api from '../config/api';
import './CandidateDetails.css';

const CandidateDetails = () => {
  const { id } = useParams();

  const { data: candidate, isLoading } = useQuery(
    ['candidate', id],
    () => api.get(`/candidates/${id}`).then(res => res.data)
  );

  if (isLoading) {
    return <div className="loading">Loading candidate details...</div>;
  }

  if (!candidate) {
    return <div className="error">Candidate not found</div>;
  }

  const profile = candidate.profile || {};

  return (
    <div className="candidate-details">
      <h1>{candidate.first_name} {candidate.last_name}</h1>
      
      <div className="candidate-info">
        <p><strong>Email:</strong> {candidate.email}</p>
        {candidate.phone && <p><strong>Phone:</strong> {candidate.phone}</p>}
        {profile.current_job_title && (
          <p><strong>Current Position:</strong> {profile.current_job_title} {profile.current_company && `at ${profile.current_company}`}</p>
        )}
        {profile.years_of_experience && (
          <p><strong>Experience:</strong> {profile.years_of_experience} years</p>
        )}
        {profile.availability && (
          <p><strong>Availability:</strong> {profile.availability.replace('-', ' ')}</p>
        )}
      </div>

      {profile && Object.keys(profile).length > 0 && (
        <div className="candidate-section">
          <h2>Profile Information</h2>
          <div className="profile-grid">
            {profile.date_of_birth && (
              <div className="profile-item">
                <strong>Date of Birth:</strong> {new Date(profile.date_of_birth).toLocaleDateString()}
              </div>
            )}
            {(profile.address || profile.city || profile.state || profile.country) && (
              <div className="profile-item">
                <strong>Address:</strong> {[profile.address, profile.city, profile.state, profile.country, profile.zip_code].filter(Boolean).join(', ')}
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
            <div className="profile-item">
              <strong>Willing to Relocate:</strong> {profile.willing_to_relocate ? 'Yes' : 'No'}
            </div>
            {profile.preferred_locations && profile.preferred_locations.length > 0 && (
              <div className="profile-item">
                <strong>Preferred Locations:</strong> {profile.preferred_locations.join(', ')}
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
        </div>
      )}

      <div className="candidate-section">
        <h2>Resumes ({candidate.resumes ? candidate.resumes.length : 0}/3)</h2>
        {candidate.resumes && candidate.resumes.length > 0 ? (
          <div className="resumes-list">
            {candidate.resumes.map((resume) => (
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
                {resume.skills && resume.skills.length > 0 && (
                  <div className="skills-list">
                    <strong>Skills:</strong>
                    {resume.skills.map((skill, idx) => (
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
                  <a
                    href={`http://localhost:5023/${resume.file_path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary btn-sm"
                    style={{ marginTop: '10px', display: 'inline-block' }}
                  >
                    View Resume
                  </a>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p>No resumes uploaded</p>
        )}
      </div>

      <div className="candidate-section">
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

      <div className="candidate-section">
        <h2>CRM Interactions</h2>
        {candidate.crm_interactions && candidate.crm_interactions.length > 0 ? (
          <div className="crm-list">
            {candidate.crm_interactions.map((interaction) => (
              <div key={interaction.id} className="crm-item">
                <h4>{interaction.interaction_type}</h4>
                <p>Date: {new Date(interaction.interaction_date).toLocaleDateString()}</p>
                {interaction.notes && <p>Notes: {interaction.notes}</p>}
                <p>Status: <span className="badge badge-info">{interaction.status}</span></p>
              </div>
            ))}
          </div>
        ) : (
          <p>No CRM interactions</p>
        )}
      </div>
    </div>
  );
};

export default CandidateDetails;

