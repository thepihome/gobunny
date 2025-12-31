import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import api from '../config/api';
import { useAuth } from '../context/AuthContext';
import { FiFilter, FiSearch, FiChevronDown, FiChevronUp, FiUser, FiBriefcase, FiX, FiRefreshCw } from 'react-icons/fi';
import './Matches.css';

const Matches = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState('jobs'); // 'jobs' or 'candidates'
  const [groupBy, setGroupBy] = useState('none'); // 'none', 'job', 'classification', 'score'
  const [filterJob, setFilterJob] = useState('');
  const [filterCandidate, setFilterCandidate] = useState('');
  const [filterClassification, setFilterClassification] = useState('');
  const [filterScoreMin, setFilterScoreMin] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [expandedJobs, setExpandedJobs] = useState(new Set());
  const [showFilters, setShowFilters] = useState(false);

  // Fetch all jobs with their matches
  const { data: jobsData, isLoading: isLoadingJobs } = useQuery(
    ['jobs-with-matches'],
    () => api.get('/jobs?include_deleted=false').then(res => res.data),
    {
      enabled: user?.role !== 'candidate'
    }
  );

  // Fetch matches for each job
  const { data: matchesData, isLoading: isLoadingMatches, refetch: refetchMatches } = useQuery(
    ['all-matches', jobsData],
    async () => {
      if (user?.role === 'candidate') {
        // For candidates, get their matches
        const response = await api.get(`/matches/candidate/${user.id}`);
        return response.data;
      } else {
        // For consultants/admins, get all matches grouped by job
        const jobs = jobsData || [];
        const allMatches = await Promise.all(
          jobs.map(async (job) => {
            try {
              const response = await api.get(`/matches/job/${job.id}`);
              return {
                job,
                matches: response.data || []
              };
            } catch (e) {
              console.error(`Error fetching matches for job ${job.id}:`, e);
              return { job, matches: [] };
            }
          })
        );
        return allMatches;
      }
    },
    {
      enabled: user?.role === 'candidate' || !!jobsData
    }
  );

  // Fetch job roles for classification filter
  const { data: jobRoles = [] } = useQuery(
    ['job-roles'],
    () => api.get('/job-roles').then(res => res.data)
  );

  // Auto-match mutation
  const autoMatchMutation = useMutation(
    (jobId) => api.post(`/matches/auto-match/${jobId}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('all-matches');
        queryClient.invalidateQueries('jobs-with-matches');
        queryClient.invalidateQueries('candidates');
      }
    }
  );

  const handleAutoMatch = async (jobId) => {
    if (window.confirm('This will match all candidates with matching job classification to this job. Continue?')) {
      autoMatchMutation.mutate(jobId);
    }
  };

  // Process and filter matches
  const processedMatches = useMemo(() => {
    if (!matchesData) return [];

    if (user?.role === 'candidate') {
      // For candidates, return their matches directly
      return matchesData.filter(match => {
        if (filterJob && !match.title?.toLowerCase().includes(filterJob.toLowerCase())) return false;
        if (filterScoreMin && match.match_score < parseFloat(filterScoreMin)) return false;
        if (filterStatus && match.status !== filterStatus) return false;
        return true;
      });
    }

    // For consultants/admins, process grouped data
    let processed = matchesData.map(({ job, matches }) => {
      const filteredMatches = matches.filter(match => {
        if (filterCandidate && !`${match.first_name} ${match.last_name}`.toLowerCase().includes(filterCandidate.toLowerCase())) return false;
        if (filterClassification && job.job_classification_name !== filterClassification) return false;
        if (filterScoreMin && match.match_score < parseFloat(filterScoreMin)) return false;
        if (filterStatus && match.status !== filterStatus) return false;
        return true;
      });

      return {
        job,
        matches: filteredMatches,
        matchCount: filteredMatches.length,
        avgScore: filteredMatches.length > 0 
          ? (filteredMatches.reduce((sum, m) => sum + (m.match_score || 0), 0) / filteredMatches.length).toFixed(1)
          : 0
      };
    }).filter(item => {
      if (filterJob && !item.job.title?.toLowerCase().includes(filterJob.toLowerCase())) return false;
      if (filterJob && !item.job.company?.toLowerCase().includes(filterJob.toLowerCase())) return false;
      return item.matchCount > 0 || !filterJob; // Show jobs with matches or if no job filter
    });

    // Group by selected option
    if (groupBy === 'classification') {
      const grouped = {};
      processed.forEach(item => {
        const key = item.job.job_classification_name || 'Unclassified';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(item);
      });
      return Object.entries(grouped).map(([classification, items]) => ({
        classification,
        items,
        totalMatches: items.reduce((sum, item) => sum + item.matchCount, 0)
      }));
    } else if (groupBy === 'score') {
      const grouped = {
        high: [],
        medium: [],
        low: []
      };
      processed.forEach(item => {
        const avg = parseFloat(item.avgScore);
        if (avg >= 70) grouped.high.push(item);
        else if (avg >= 50) grouped.medium.push(item);
        else grouped.low.push(item);
      });
      return Object.entries(grouped).filter(([_, items]) => items.length > 0).map(([range, items]) => ({
        range,
        items,
        totalMatches: items.reduce((sum, item) => sum + item.matchCount, 0)
      }));
    }

    return processed;
  }, [matchesData, filterJob, filterCandidate, filterClassification, filterScoreMin, filterStatus, groupBy, user?.role]);

  const toggleJobExpanded = (jobId) => {
    setExpandedJobs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(jobId)) {
        newSet.delete(jobId);
      } else {
        newSet.add(jobId);
      }
      return newSet;
    });
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'info';
    if (score >= 40) return 'warning';
    return 'danger';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'shortlisted': return 'success';
      case 'reviewed': return 'info';
      case 'rejected': return 'danger';
      default: return 'secondary';
    }
  };

  if (isLoadingJobs || isLoadingMatches) {
    return <div className="loading">Loading matches...</div>;
  }

  return (
    <div className="matches-page">
      <div className="page-header">
        <h1>Job Matches</h1>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            className="btn btn-secondary"
            onClick={() => setShowFilters(!showFilters)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <FiFilter /> {showFilters ? 'Hide' : 'Show'} Filters
          </button>
          {user?.role !== 'candidate' && (
            <button
              className="btn btn-primary"
              onClick={() => refetchMatches()}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <FiRefreshCw /> Refresh Matches
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="matches-filters">
          <div className="filter-row">
            <div className="filter-group">
              <label>Group By</label>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
              >
                <option value="none">No Grouping</option>
                <option value="classification">Job Classification</option>
                <option value="score">Match Score Range</option>
              </select>
            </div>
            {user?.role !== 'candidate' && (
              <>
                <div className="filter-group">
                  <label>Job/Company</label>
                  <input
                    type="text"
                    placeholder="Search jobs or companies..."
                    value={filterJob}
                    onChange={(e) => setFilterJob(e.target.value)}
                  />
                </div>
                <div className="filter-group">
                  <label>Candidate</label>
                  <input
                    type="text"
                    placeholder="Search candidates..."
                    value={filterCandidate}
                    onChange={(e) => setFilterCandidate(e.target.value)}
                  />
                </div>
                <div className="filter-group">
                  <label>Classification</label>
                  <select
                    value={filterClassification}
                    onChange={(e) => setFilterClassification(e.target.value)}
                  >
                    <option value="">All Classifications</option>
                    {jobRoles
                      .filter(role => role.is_active === 1 || role.is_active === true)
                      .map(role => (
                        <option key={role.id} value={role.name}>{role.name}</option>
                      ))}
                  </select>
                </div>
              </>
            )}
            <div className="filter-group">
              <label>Min Score</label>
              <input
                type="number"
                placeholder="e.g., 50"
                min="0"
                max="100"
                value={filterScoreMin}
                onChange={(e) => setFilterScoreMin(e.target.value)}
              />
            </div>
            <div className="filter-group">
              <label>Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="reviewed">Reviewed</option>
                <option value="shortlisted">Shortlisted</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            {(filterJob || filterCandidate || filterClassification || filterScoreMin || filterStatus) && (
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setFilterJob('');
                  setFilterCandidate('');
                  setFilterClassification('');
                  setFilterScoreMin('');
                  setFilterStatus('');
                }}
              >
                <FiX /> Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Matches Display */}
      <div className="matches-content">
        {user?.role === 'candidate' ? (
          // Candidate view - show their matches
          <div className="matches-list">
            {processedMatches && processedMatches.length > 0 ? (
              processedMatches.map((match) => (
                <div key={match.id} className="match-card">
                  <div className="match-header">
                    <div>
                      <h3 onClick={() => navigate(`/jobs/${match.job_id}`)} style={{ cursor: 'pointer' }}>
                        {match.title || match.job_title}
                      </h3>
                      <p className="match-company">{match.company}</p>
                    </div>
                    <div className="match-score">
                      <span className={`badge badge-${getScoreColor(match.match_score)}`}>
                        {match.match_score}% Match
                      </span>
                    </div>
                  </div>
                  {match.location && (
                    <p className="match-location">📍 {match.location}</p>
                  )}
                  {match.status && (
                    <p className="match-status">
                      Status: <span className={`badge badge-${getStatusColor(match.status)}`}>{match.status}</span>
                    </p>
                  )}
                </div>
              ))
            ) : (
              <div className="empty-state">No matches found</div>
            )}
          </div>
        ) : (
          // Consultant/Admin view - show jobs with matched candidates
          <div className="matches-by-job">
            {groupBy === 'classification' ? (
              // Grouped by classification
              processedMatches.map((group) => (
                <div key={group.classification} className="match-group">
                  <div className="group-header">
                    <h2>{group.classification}</h2>
                    <span className="group-count">{group.totalMatches} matches</span>
                  </div>
                  <div className="group-items">
                    {group.items.map(({ job, matches, matchCount, avgScore }) => (
                      <div key={job.id} className="job-match-card">
                        <div className="job-match-header" onClick={() => toggleJobExpanded(job.id)}>
                          <div>
                            <h3>{job.company} - {job.title}</h3>
                            <p className="job-match-info">
                              {matchCount} candidate{matchCount !== 1 ? 's' : ''} matched
                              {avgScore > 0 && ` • Avg Score: ${avgScore}%`}
                            </p>
                          </div>
                          <div className="job-match-actions">
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAutoMatch(job.id);
                              }}
                              title="Re-match candidates"
                            >
                              <FiRefreshCw /> Re-match
                            </button>
                            {expandedJobs.has(job.id) ? <FiChevronUp /> : <FiChevronDown />}
                          </div>
                        </div>
                        {expandedJobs.has(job.id) && (
                          <div className="job-match-candidates">
                            {matches.length > 0 ? (
                              <table className="matches-table">
                                <thead>
                                  <tr>
                                    <th>Candidate</th>
                                    <th>Classification</th>
                                    <th>Match Score</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {matches.map((match) => (
                                    <tr key={match.id}>
                                      <td>
                                        <div className="candidate-cell">
                                          <FiUser />
                                          <strong>{match.first_name} {match.last_name}</strong>
                                          <span className="candidate-email">{match.email}</span>
                                        </div>
                                      </td>
                                      <td>{match.current_job_title || 'N/A'}</td>
                                      <td>
                                        <span className={`badge badge-${getScoreColor(match.match_score)}`}>
                                          {match.match_score}%
                                        </span>
                                      </td>
                                      <td>
                                        <span className={`badge badge-${getStatusColor(match.status)}`}>
                                          {match.status || 'pending'}
                                        </span>
                                      </td>
                                      <td>
                                        <button
                                          className="btn btn-sm btn-secondary"
                                          onClick={() => navigate(`/candidates/${match.candidate_id}`)}
                                        >
                                          View Profile
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <div className="empty-state">No candidates matched</div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : groupBy === 'score' ? (
              // Grouped by score range
              processedMatches.map((group) => (
                <div key={group.range} className="match-group">
                  <div className="group-header">
                    <h2>
                      {group.range === 'high' ? 'High Match (70%+)' : 
                       group.range === 'medium' ? 'Medium Match (50-69%)' : 
                       'Low Match (<50%)'}
                    </h2>
                    <span className="group-count">{group.totalMatches} matches</span>
                  </div>
                  <div className="group-items">
                    {group.items.map(({ job, matches, matchCount, avgScore }) => (
                      <div key={job.id} className="job-match-card">
                        <div className="job-match-header" onClick={() => toggleJobExpanded(job.id)}>
                          <div>
                            <h3>{job.company} - {job.title}</h3>
                            <p className="job-match-info">
                              {matchCount} candidate{matchCount !== 1 ? 's' : ''} matched
                              {avgScore > 0 && ` • Avg Score: ${avgScore}%`}
                            </p>
                          </div>
                          <div className="job-match-actions">
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAutoMatch(job.id);
                              }}
                              title="Re-match candidates"
                            >
                              <FiRefreshCw /> Re-match
                            </button>
                            {expandedJobs.has(job.id) ? <FiChevronUp /> : <FiChevronDown />}
                          </div>
                        </div>
                        {expandedJobs.has(job.id) && (
                          <div className="job-match-candidates">
                            {matches.length > 0 ? (
                              <table className="matches-table">
                                <thead>
                                  <tr>
                                    <th>Candidate</th>
                                    <th>Classification</th>
                                    <th>Match Score</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {matches.map((match) => (
                                    <tr key={match.id}>
                                      <td>
                                        <div className="candidate-cell">
                                          <FiUser />
                                          <strong>{match.first_name} {match.last_name}</strong>
                                          <span className="candidate-email">{match.email}</span>
                                        </div>
                                      </td>
                                      <td>{match.current_job_title || 'N/A'}</td>
                                      <td>
                                        <span className={`badge badge-${getScoreColor(match.match_score)}`}>
                                          {match.match_score}%
                                        </span>
                                      </td>
                                      <td>
                                        <span className={`badge badge-${getStatusColor(match.status)}`}>
                                          {match.status || 'pending'}
                                        </span>
                                      </td>
                                      <td>
                                        <button
                                          className="btn btn-sm btn-secondary"
                                          onClick={() => navigate(`/candidates/${match.candidate_id}`)}
                                        >
                                          View Profile
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <div className="empty-state">No candidates matched</div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              // No grouping - flat list
              processedMatches && processedMatches.length > 0 ? (
                processedMatches.map(({ job, matches, matchCount, avgScore }) => (
                  <div key={job.id} className="job-match-card">
                    <div className="job-match-header" onClick={() => toggleJobExpanded(job.id)}>
                      <div>
                        <h3>{job.company} - {job.title}</h3>
                        <p className="job-match-info">
                          {matchCount} candidate{matchCount !== 1 ? 's' : ''} matched
                          {avgScore > 0 && ` • Avg Score: ${avgScore}%`}
                          {job.job_classification_name && ` • Classification: ${job.job_classification_name}`}
                        </p>
                      </div>
                      <div className="job-match-actions">
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAutoMatch(job.id);
                          }}
                          title="Re-match candidates"
                        >
                          <FiRefreshCw /> Re-match
                        </button>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/jobs/${job.id}`);
                          }}
                        >
                          View Job
                        </button>
                        {expandedJobs.has(job.id) ? <FiChevronUp /> : <FiChevronDown />}
                      </div>
                    </div>
                    {expandedJobs.has(job.id) && (
                      <div className="job-match-candidates">
                        {matches.length > 0 ? (
                          <table className="matches-table">
                            <thead>
                              <tr>
                                <th>Candidate</th>
                                <th>Classification</th>
                                <th>Match Score</th>
                                <th>Status</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {matches.map((match) => (
                                <tr key={match.id}>
                                  <td>
                                    <div className="candidate-cell">
                                      <FiUser />
                                      <strong>{match.first_name} {match.last_name}</strong>
                                      <span className="candidate-email">{match.email}</span>
                                    </div>
                                  </td>
                                  <td>{match.current_job_title || 'N/A'}</td>
                                  <td>
                                    <span className={`badge badge-${getScoreColor(match.match_score)}`}>
                                      {match.match_score}%
                                    </span>
                                  </td>
                                  <td>
                                    <span className={`badge badge-${getStatusColor(match.status)}`}>
                                      {match.status || 'pending'}
                                    </span>
                                  </td>
                                  <td>
                                    <button
                                      className="btn btn-sm btn-secondary"
                                      onClick={() => navigate(`/candidates/${match.candidate_id}`)}
                                    >
                                      View Profile
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className="empty-state">No candidates matched</div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="empty-state">No matches found</div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Matches;
