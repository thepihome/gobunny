import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import api from '../config/api';
import { useAuth } from '../context/AuthContext';
import { FiPlus, FiMapPin, FiDollarSign, FiX, FiBriefcase, FiLink, FiEdit, FiTrash2, FiZap, FiFilter, FiSave } from 'react-icons/fi';
import { useResizableColumns } from '../hooks/useResizableColumns';
import LoadingButton, { iconSpinClass } from '../components/LoadingButton';
import './Jobs.css';

const JOB_COL_WIDTHS_CANDIDATE = [150, 250, 180, 100, 120, 96, 118];
const JOB_COL_MINS_CANDIDATE = [100, 140, 90, 80, 96, 80, 108];
const JOB_COL_WIDTHS_STAFF = [150, 250, 180, 100, 120, 120, 124, 168];
const JOB_COL_MINS_STAFF = [100, 140, 90, 80, 96, 88, 112, 148];

const Jobs = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('');
  const [employmentType, setEmploymentType] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showPostJobModal, setShowPostJobModal] = useState(false);
  const [editingJob, setEditingJob] = useState(null);

  // Fetch job roles for classification dropdown
  const { data: jobRoles = [] } = useQuery(
    ['job-roles'],
    () => api.get('/job-roles').then(res => res.data),
    {
      enabled: showPostJobModal
    }
  );
  const [jobFormData, setJobFormData] = useState({
    title: '',
    job_classification: '',
    description: '',
    company: '',
    location: '',
    salary_min: '',
    salary_max: '',
    employment_type: 'full-time',
    required_skills: '',
    preferred_skills: '',
    experience_level: 'mid',
    external_apply_link: '',
    status: 'active',
  });

  const { data: jobs, isLoading } = useQuery(
    ['jobs', search, location, employmentType],
    () => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (location) params.append('location', location);
      if (employmentType) params.append('employment_type', employmentType);
      return api.get(`/jobs?${params.toString()}`).then(res => res.data);
    }
  );

  const createJobMutation = useMutation(
    (data) => api.post('/jobs', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('jobs');
        setShowPostJobModal(false);
        setEditingJob(null);
        setJobFormData({
          title: '',
          description: '',
          company: '',
          location: '',
          salary_min: '',
          salary_max: '',
          employment_type: 'full-time',
          required_skills: '',
          preferred_skills: '',
          experience_level: 'mid',
          external_apply_link: '',
          status: 'active',
        });
      },
    }
  );

  const updateJobMutation = useMutation(
    ({ id, data }) => api.put(`/jobs/${id}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('jobs');
        setShowPostJobModal(false);
        setEditingJob(null);
        setJobFormData({
          title: '',
          description: '',
          company: '',
          location: '',
          salary_min: '',
          salary_max: '',
          employment_type: 'full-time',
          required_skills: '',
          preferred_skills: '',
          experience_level: 'mid',
          external_apply_link: '',
          status: 'active',
        });
      },
    }
  );

  const deleteJobMutation = useMutation(
    (id) => api.delete(`/jobs/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('jobs');
      },
    }
  );

  const aiMatchJobMutation = useMutation(
    (jobId) => api.post(`/matches/ai-recompute-job/${jobId}`),
    {
      onSuccess: (res) => {
        queryClient.invalidateQueries('jobs');
        queryClient.invalidateQueries('all-matches');
        window.alert(
          `AI matching finished: ${res.data.upserted} pairs saved, ${res.data.below_threshold_removed} below threshold removed.`
        );
      },
      onError: (e) => window.alert(e.response?.data?.error || e.message),
    }
  );

  const isCandidate = user?.role === 'candidate';
  const isStaff = user?.role === 'consultant' || user?.role === 'admin';

  // Initialize resizable columns hook (candidate: match score; staff: coverage %)
  const { getColumnProps, ResizeHandle, tableRef } = useResizableColumns(
    isCandidate ? JOB_COL_WIDTHS_CANDIDATE : JOB_COL_WIDTHS_STAFF,
    isCandidate ? 'jobs-column-widths-candidate' : 'jobs-column-widths-staff',
    isCandidate ? JOB_COL_MINS_CANDIDATE : JOB_COL_MINS_STAFF
  );

  const handlePostJob = (e) => {
    e.preventDefault();
    const submitData = {
      ...jobFormData,
      salary_min: jobFormData.salary_min ? parseInt(jobFormData.salary_min) : null,
      salary_max: jobFormData.salary_max ? parseInt(jobFormData.salary_max) : null,
      required_skills: jobFormData.required_skills
        ? jobFormData.required_skills.split(',').map(s => s.trim()).filter(s => s)
        : [],
      preferred_skills: jobFormData.preferred_skills
        ? jobFormData.preferred_skills.split(',').map(s => s.trim()).filter(s => s)
        : [],
    };
    
    if (editingJob) {
      updateJobMutation.mutate({ id: editingJob.id, data: submitData });
    } else {
      createJobMutation.mutate(submitData);
    }
  };

  const handleEditJob = (job, e) => {
    e.stopPropagation();
    setEditingJob(job);
    setJobFormData({
      title: job.title || '',
      job_classification: job.job_classification || '',
      description: job.description || '',
      company: job.company || '',
      location: job.location || '',
      salary_min: job.salary_min || '',
      salary_max: job.salary_max || '',
      employment_type: job.employment_type || 'full-time',
      required_skills: job.required_skills ? job.required_skills.join(', ') : '',
      preferred_skills: job.preferred_skills ? job.preferred_skills.join(', ') : '',
      experience_level: job.experience_level || 'mid',
      external_apply_link: job.external_apply_link || '',
      status: job.status || 'active',
    });
    setShowPostJobModal(true);
  };

  const handleJobClick = (job) => {
    navigate(`/jobs/${job.id}`);
  };

  const handleDeleteJob = (job, e) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${job.title}"? This will soft delete the job.`)) {
      deleteJobMutation.mutate(job.id);
    }
  };

  if (isLoading) {
    return <div className="loading">Loading jobs...</div>;
  }

  const hasJobFilters = Boolean(search || location || employmentType);

  return (
    <div className="jobs-page list-page">
      <div className="page-header">
        <h1>Job Openings</h1>
        <div className="list-page-header-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowFilters(!showFilters)}
          >
            <FiFilter /> {showFilters ? 'Hide' : 'Show'} filters
          </button>
          {(user?.role === 'consultant' || user?.role === 'admin') && (
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => setShowPostJobModal(true)}
            >
              <FiPlus /> Post New Job
            </button>
          )}
        </div>
      </div>

      {showFilters && (
        <div className="list-filters-panel">
          <div className="filter-row">
            <div className="filter-group filter-group--wide">
              <label htmlFor="jobs-filter-search">Search</label>
              <input
                id="jobs-filter-search"
                type="text"
                placeholder="Title, company, skills…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="filter-group">
              <label htmlFor="jobs-filter-location">Location</label>
              <input
                id="jobs-filter-location"
                type="text"
                placeholder="City or region"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="filter-group">
              <label htmlFor="jobs-filter-type">Employment</label>
              <select
                id="jobs-filter-type"
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value)}
              >
                <option value="">All types</option>
                <option value="full-time">Full time</option>
                <option value="part-time">Part time</option>
                <option value="contract">Contract</option>
                <option value="remote">Remote</option>
              </select>
            </div>
            {hasJobFilters && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setSearch('');
                  setLocation('');
                  setEmploymentType('');
                }}
              >
                <FiX /> Clear
              </button>
            )}
          </div>
        </div>
      )}

      <div className="jobs-table-container">
        <table ref={tableRef} className="table jobs-table" style={{ tableLayout: 'fixed', width: '100%' }}>
          <thead>
            <tr>
              <th {...getColumnProps(0)}>Company<ResizeHandle index={0} /></th>
              <th {...getColumnProps(1)}>Job Title<ResizeHandle index={1} /></th>
              <th {...getColumnProps(2)}>Location<ResizeHandle index={2} /></th>
              <th {...getColumnProps(3)}>Type<ResizeHandle index={3} /></th>
              <th {...getColumnProps(4)}>Salary<ResizeHandle index={4} /></th>
              {isCandidate && (
                <th {...getColumnProps(5)}>Match<ResizeHandle index={5} /></th>
              )}
              {isStaff && (
                <th {...getColumnProps(5)} title="Distinct candidates with a stored match / all active candidates">
                  Match coverage<ResizeHandle index={5} />
                </th>
              )}
              <th {...getColumnProps(isCandidate || isStaff ? 6 : 5)} className="col-status">
                Status
                <ResizeHandle index={isCandidate || isStaff ? 6 : 5} />
              </th>
              {isStaff && (
                <th {...getColumnProps(7)} className="col-actions">
                  Actions
                  <ResizeHandle index={7} />
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {jobs && jobs.length > 0 ? (
              jobs.map((job) => (
                <tr 
                  key={job.id} 
                  className="job-row"
                  onClick={() => handleJobClick(job)}
                >
                  <td>
                    <strong>{job.company}</strong>
                  </td>
                  <td>
                    <div className="job-title-cell">
                      <strong>{job.title}</strong>
                      {job.required_skills && job.required_skills.length > 0 && (
                        <div className="job-skills-inline">
                          {job.required_skills.slice(0, 2).map((skill, idx) => (
                            <span key={idx} className="skill-tag-small">{skill}</span>
                          ))}
                          {job.required_skills.length > 2 && (
                            <span className="skill-tag-small">+{job.required_skills.length - 2}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    {job.location ? (
                      <span className="job-location-inline">
                        <FiMapPin /> {job.location}
                      </span>
                    ) : (
                      'N/A'
                    )}
                  </td>
                  <td>
                    {job.employment_type ? (
                      <span className="job-type-badge">{job.employment_type}</span>
                    ) : (
                      'N/A'
                    )}
                  </td>
                  <td>
                    {(job.salary_min || job.salary_max) ? (
                      <span className="job-salary-inline">
                        <FiDollarSign /> {job.salary_min && job.salary_max
                          ? `$${job.salary_min.toLocaleString()} - $${job.salary_max.toLocaleString()}`
                          : job.salary_min
                          ? `$${job.salary_min.toLocaleString()}+`
                          : `Up to $${job.salary_max.toLocaleString()}`}
                      </span>
                    ) : (
                      'Not disclosed'
                    )}
                  </td>
                  {isCandidate && (
                    <td>
                      <strong>{job.match_score != null ? `${Math.round(Number(job.match_score))}%` : '—'}</strong>
                    </td>
                  )}
                  {isStaff && (
                    <td>
                      <span title={`${job.matched_candidate_count || 0} candidates with a match`}>
                        {job.match_percentage != null ? `${job.match_percentage}%` : '0%'}
                        <span style={{ color: '#888', fontSize: 12, marginLeft: 6 }}>
                          ({job.matched_candidate_count ?? 0})
                        </span>
                      </span>
                    </td>
                  )}
                  <td className="col-status">
                    <span
                      className={`badge badge-${job.status === 'active' ? 'success' : job.status === 'closed' ? 'warning' : job.status === 'draft' ? 'info' : 'danger'}`}
                    >
                      {job.status}
                    </span>
                  </td>
                  {isStaff && (
                    <td className="col-actions" onClick={(e) => e.stopPropagation()}>
                      <div className="job-actions-inline">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Run AI matching for "${job.title}"?`)) {
                              aiMatchJobMutation.mutate(job.id);
                            }
                          }}
                          className="btn btn-secondary btn-sm"
                          title="AI match candidates to this job"
                          disabled={aiMatchJobMutation.isLoading && aiMatchJobMutation.variables === job.id}
                        >
                          <FiZap className={iconSpinClass(aiMatchJobMutation.isLoading && aiMatchJobMutation.variables === job.id)} />
                        </button>
                        <button
                          onClick={(e) => handleEditJob(job, e)}
                          className="btn btn-secondary btn-sm"
                          title="Edit job"
                        >
                          <FiEdit />
                        </button>
                        <button
                          onClick={(e) => handleDeleteJob(job, e)}
                          className="btn btn-danger btn-sm"
                          title="Delete job"
                          disabled={deleteJobMutation.isLoading && deleteJobMutation.variables === job.id}
                        >
                          <FiTrash2 className={iconSpinClass(deleteJobMutation.isLoading && deleteJobMutation.variables === job.id)} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={isCandidate ? 7 : isStaff ? 8 : 6} className="empty-state">
                  {isCandidate ? 'No matched jobs yet. An admin can run AI matching in Settings.' : 'No jobs found'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Post/Edit Job Modal */}
      {showPostJobModal && (
        <div className="modal-overlay" onClick={() => {
          setShowPostJobModal(false);
          setEditingJob(null);
        }}>
          <div className="modal-content post-job-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <FiBriefcase /> {editingJob ? 'Edit Job' : 'Post New Job'}
              </h2>
              <button
                className="btn-close-modal"
                onClick={() => {
                  setShowPostJobModal(false);
                  setEditingJob(null);
                }}
              >
                <FiX />
              </button>
            </div>

            <form onSubmit={handlePostJob} className="post-job-form">
              <div className="form-section">
                <h3>Basic Information</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Company *</label>
                    <input
                      type="text"
                      value={jobFormData.company}
                      onChange={(e) => setJobFormData({ ...jobFormData, company: e.target.value })}
                      placeholder="Company name"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Job Title *</label>
                    <input
                      type="text"
                      value={jobFormData.title}
                      onChange={(e) => setJobFormData({ ...jobFormData, title: e.target.value })}
                      placeholder="e.g., Senior Software Engineer"
                      required
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Job Classification</label>
                    <select
                      value={jobFormData.job_classification || ''}
                      onChange={(e) => setJobFormData({ ...jobFormData, job_classification: e.target.value })}
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
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Location</label>
                    <input
                      type="text"
                      value={jobFormData.location}
                      onChange={(e) => setJobFormData({ ...jobFormData, location: e.target.value })}
                      placeholder="e.g., San Francisco, CA or Remote"
                    />
                  </div>
                  <div className="form-group">
                    <label>Employment Type</label>
                    <select
                      value={jobFormData.employment_type}
                      onChange={(e) => setJobFormData({ ...jobFormData, employment_type: e.target.value })}
                    >
                      <option value="full-time">Full Time</option>
                      <option value="part-time">Part Time</option>
                      <option value="contract">Contract</option>
                      <option value="temporary">Temporary</option>
                      <option value="internship">Internship</option>
                      <option value="remote">Remote</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Job Description *</label>
                  <textarea
                    value={jobFormData.description}
                    onChange={(e) => setJobFormData({ ...jobFormData, description: e.target.value })}
                    placeholder="Provide a detailed description of the job role, responsibilities, and requirements..."
                    rows="6"
                    required
                  />
                </div>
              </div>

              <div className="form-section">
                <h3>Compensation</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Minimum Salary</label>
                    <input
                      type="number"
                      value={jobFormData.salary_min}
                      onChange={(e) => setJobFormData({ ...jobFormData, salary_min: e.target.value })}
                      placeholder="e.g., 80000"
                      min="0"
                    />
                  </div>
                  <div className="form-group">
                    <label>Maximum Salary</label>
                    <input
                      type="number"
                      value={jobFormData.salary_max}
                      onChange={(e) => setJobFormData({ ...jobFormData, salary_max: e.target.value })}
                      placeholder="e.g., 120000"
                      min="0"
                    />
                  </div>
                </div>
                <p className="form-hint">Leave blank if salary is not disclosed</p>
              </div>

              <div className="form-section">
                <h3>Requirements</h3>
                <div className="form-group">
                  <label>Experience Level</label>
                  <select
                    value={jobFormData.experience_level}
                    onChange={(e) => setJobFormData({ ...jobFormData, experience_level: e.target.value })}
                  >
                    <option value="entry">Entry Level</option>
                    <option value="junior">Junior (1-3 years)</option>
                    <option value="mid">Mid Level (3-5 years)</option>
                    <option value="senior">Senior (5-8 years)</option>
                    <option value="lead">Lead (8+ years)</option>
                    <option value="executive">Executive</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Required Skills *</label>
                  <input
                    type="text"
                    value={jobFormData.required_skills}
                    onChange={(e) => setJobFormData({ ...jobFormData, required_skills: e.target.value })}
                    placeholder="Comma-separated: JavaScript, React, Node.js"
                    required
                  />
                  <p className="form-hint">Separate multiple skills with commas</p>
                </div>

                <div className="form-group">
                  <label>Preferred Skills</label>
                  <input
                    type="text"
                    value={jobFormData.preferred_skills}
                    onChange={(e) => setJobFormData({ ...jobFormData, preferred_skills: e.target.value })}
                    placeholder="Comma-separated: TypeScript, AWS, Docker"
                  />
                  <p className="form-hint">Optional skills that would be nice to have</p>
                </div>
              </div>

              <div className="form-section">
                <h3>Application</h3>
                <div className="form-group">
                  <label>
                    <FiLink /> External Apply Link
                  </label>
                  <input
                    type="url"
                    value={jobFormData.external_apply_link}
                    onChange={(e) => setJobFormData({ ...jobFormData, external_apply_link: e.target.value })}
                    placeholder="https://company.com/careers/apply"
                  />
                  <p className="form-hint">Link to external job application page (optional)</p>
                </div>

                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={jobFormData.status}
                    onChange={(e) => setJobFormData({ ...jobFormData, status: e.target.value })}
                  >
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowPostJobModal(false);
                    setEditingJob(null);
                  }}
                >
                  Cancel
                </button>
                <LoadingButton
                  type="submit"
                  className="btn btn-primary"
                  icon={FiSave}
                  loading={createJobMutation.isLoading || updateJobMutation.isLoading}
                  loadingLabel={editingJob ? 'Updating...' : 'Posting...'}
                >
                  {editingJob ? 'Update Job' : 'Post Job'}
                </LoadingButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Jobs;

