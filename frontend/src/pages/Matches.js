import React from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import api from '../config/api';
import { useAuth } from '../context/AuthContext';
import './Matches.css';

const Matches = () => {
  const { user } = useAuth();

  const { data: matches, isLoading } = useQuery(
    ['matches', user?.role],
    () => {
      if (user?.role === 'candidate') {
        return api.get('/matches/my-matches').then(res => res.data);
      } else {
        return api.get('/matches').then(res => res.data);
      }
    }
  );

  if (isLoading) {
    return <div className="loading">Loading matches...</div>;
  }

  const getScoreColor = (score) => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'info';
    if (score >= 40) return 'warning';
    return 'danger';
  };

  return (
    <div className="matches-page">
      <h1>Job Matches</h1>
      <div className="matches-list">
        {matches && matches.length > 0 ? (
          matches.map((match) => (
            <div key={match.id} className="match-card">
              <div className="match-header">
                <div>
                  <h3>
                    <Link to={`/jobs/${match.job_id}`}>
                      {match.job_title || match.title}
                    </Link>
                  </h3>
                  <p className="match-company">{match.company}</p>
                </div>
                <div className="match-score">
                  <span className={`badge badge-${getScoreColor(match.match_score)}`}>
                    {match.match_score}% Match
                  </span>
                </div>
              </div>
              {user?.role !== 'candidate' && (
                <p className="match-candidate">
                  Candidate: {match.first_name} {match.last_name} ({match.email})
                </p>
              )}
              {match.location && (
                <p className="match-location">📍 {match.location}</p>
              )}
              {match.skills_match !== undefined && (
                <p className="match-details">Skills Match: {match.skills_match}</p>
              )}
              {match.status && (
                <p className="match-status">
                  Status: <span className={`badge badge-info`}>{match.status}</span>
                </p>
              )}
              {match.notes && (
                <p className="match-notes">Notes: {match.notes}</p>
              )}
            </div>
          ))
        ) : (
          <div className="empty-state">No matches found</div>
        )}
      </div>
    </div>
  );
};

export default Matches;


