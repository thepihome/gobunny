import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import api from '../config/api';
import { useAuth } from '../context/AuthContext';
import { FiPlus, FiMapPin, FiDollarSign, FiX, FiFilter, FiZap } from 'react-icons/fi';
import { useResizableColumns } from '../hooks/useResizableColumns';
import { useBulkSelection } from '../hooks/useBulkSelection';
import { iconSpinClass } from '../components/LoadingButton';
import JobFormModal from '../components/JobFormModal';
import BulkActionBar from '../components/BulkActionBar';
import IconButton from '../components/IconButton';
import { downloadCsv } from '../utils/exportCsv';
import { LISTING_TYPE_OPTIONS, listingTypeBadgeClass } from '../utils/listingType';
import './Jobs.css';

const SELECT_COL = 44;
const JOB_COL_WIDTHS_CANDIDATE = [SELECT_COL, 150, 250, 180, 100, 120, 96, 118];
const JOB_COL_MINS_CANDIDATE = [44, 100, 140, 90, 80, 96, 80, 108];
const JOB_COL_WIDTHS_STAFF = [SELECT_COL, 150, 250, 180, 100, 120, 108, 100, 100, 112];
const JOB_COL_MINS_STAFF = [44, 100, 140, 90, 80, 96, 88, 88, 88, 96];

const JOB_EXPORT_COLUMNS = [
  { key: 'company', label: 'Company' },
  { key: 'title', label: 'Job Title' },
  { key: 'location', label: 'Location' },
  { key: 'employment_type', label: 'Employment Type' },
  {
    key: 'salary',
    label: 'Salary',
    format: (row) => {
      if (row.salary_min && row.salary_max) return `${row.salary_min}-${row.salary_max}`;
      if (row.salary_min) return `${row.salary_min}+`;
      if (row.salary_max) return `Up to ${row.salary_max}`;
      return '';
    },
  },
  { key: 'status', label: 'Status' },
  { key: 'listing_type', label: 'Listing' },
];

const Jobs = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('');
  const [employmentType, setEmploymentType] = useState('');
  const [listingType, setListingType] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showPostJobModal, setShowPostJobModal] = useState(false);
  const [jobViewMode, setJobViewMode] = useState('matched');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkAction, setBulkAction] = useState(null);

  const { data: jobs, isLoading } = useQuery(
    ['jobs', search, location, employmentType, listingType, jobViewMode],
    () => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (location) params.append('location', location);
      if (employmentType) params.append('employment_type', employmentType);
      if (listingType) params.append('listing_type', listingType);
      const isCandidateBrowse = user?.role === 'candidate' && jobViewMode === 'browse';
      const endpoint = isCandidateBrowse
        ? `/jobs/opportunities?${params.toString()}`
        : `/jobs?${params.toString()}`;
      return api.get(endpoint).then(res => res.data);
    }
  );

  const listingTypeMutation = useMutation(
    ({ id, listing_type }) => api.patch(`/jobs/${id}/listing-type`, { listing_type }),
    {
      onSuccess: () => queryClient.invalidateQueries('jobs'),
      onError: (e) => window.alert(e.response?.data?.error || e.message),
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

  const jobList = jobs || [];
  const {
    selectedItems,
    selectedCount,
    allSelected,
    someSelected,
    toggleOne,
    toggleAll,
    clearSelection,
    isSelected,
  } = useBulkSelection(jobList);

  // Initialize resizable columns hook (candidate: match score; staff: coverage %)
  const { getColumnProps, ResizeHandle, tableRef } = useResizableColumns(
    isCandidate ? JOB_COL_WIDTHS_CANDIDATE : JOB_COL_WIDTHS_STAFF,
    isCandidate ? 'jobs-column-widths-candidate' : 'jobs-column-widths-staff',
    isCandidate ? JOB_COL_MINS_CANDIDATE : JOB_COL_MINS_STAFF
  );

  const handleJobClick = (job) => {
    navigate(`/jobs/${job.id}`);
  };

  const handleBulkExport = () => {
    downloadCsv(selectedItems, JOB_EXPORT_COLUMNS, `jobs-export-${Date.now()}.csv`);
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Soft-delete ${selectedCount} job(s)? They will be marked as deleted.`)) return;
    setBulkBusy(true);
    setBulkAction('delete');
    try {
      await Promise.all(selectedItems.map((job) => api.delete(`/jobs/${job.id}`)));
      queryClient.invalidateQueries('jobs');
      clearSelection();
    } catch (e) {
      window.alert(e.response?.data?.error || e.message);
    } finally {
      setBulkBusy(false);
      setBulkAction(null);
    }
  };

  const handleBulkMatch = async () => {
    if (!window.confirm(`Run AI matching for ${selectedCount} job(s)?`)) return;
    setBulkBusy(true);
    setBulkAction('match');
    try {
      const results = await Promise.all(
        selectedItems.map((job) => api.post(`/matches/ai-recompute-job/${job.id}`).then((res) => res.data))
      );
      const upserted = results.reduce((sum, r) => sum + (r.upserted || 0), 0);
      const removed = results.reduce((sum, r) => sum + (r.below_threshold_removed || 0), 0);
      queryClient.invalidateQueries('jobs');
      queryClient.invalidateQueries('all-matches');
      window.alert(`AI matching finished: ${upserted} pairs saved, ${removed} below threshold removed.`);
      clearSelection();
    } catch (e) {
      window.alert(e.response?.data?.error || e.message);
    } finally {
      setBulkBusy(false);
      setBulkAction(null);
    }
  };

  if (isLoading) {
    return <div className="loading">Loading jobs...</div>;
  }

  const hasJobFilters = Boolean(search || location || employmentType || listingType);

  return (
    <div className="jobs-page list-page">
      <div className="page-header">
        <h1>Job Openings</h1>
        <div className="list-page-header-actions page-toolbar">
          {isCandidate && (
            <div className="job-mode-toggle">
              <button
                type="button"
                className={jobViewMode === 'matched' ? 'active' : ''}
                onClick={() => setJobViewMode('matched')}
              >
                My matches
              </button>
              <button
                type="button"
                className={jobViewMode === 'browse' ? 'active' : ''}
                onClick={() => setJobViewMode('browse')}
              >
                Browse all
              </button>
            </div>
          )}
          <IconButton
            icon={FiFilter}
            label={showFilters ? 'Hide filters' : 'Show filters'}
            active={showFilters}
            onClick={() => setShowFilters(!showFilters)}
          />
          {(user?.role === 'consultant' || user?.role === 'admin') && (
            <IconButton
              icon={FiPlus}
              label="Post new job"
              variant="primary"
              onClick={() => setShowPostJobModal(true)}
            />
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
            {isStaff && (
              <div className="filter-group">
                <label htmlFor="jobs-filter-listing">Listing</label>
                <select
                  id="jobs-filter-listing"
                  value={listingType}
                  onChange={(e) => setListingType(e.target.value)}
                >
                  <option value="">All listings</option>
                  {LISTING_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}
            {hasJobFilters && (
              <IconButton
                icon={FiX}
                label="Clear filters"
                onClick={() => {
                  setSearch('');
                  setLocation('');
                  setEmploymentType('');
                  setListingType('');
                }}
              />
            )}
          </div>
        </div>
      )}

      <BulkActionBar
        count={selectedCount}
        onClear={clearSelection}
        onExport={handleBulkExport}
        onDelete={isStaff ? handleBulkDelete : undefined}
        onMatch={isStaff ? handleBulkMatch : undefined}
        showDelete={isStaff}
        showMatch={isStaff}
        busy={bulkBusy}
        busyAction={bulkAction}
      />

      <div className="jobs-table-container">
        <table ref={tableRef} className="table jobs-table" style={{ tableLayout: 'fixed', width: '100%' }}>
          <thead>
            <tr>
              <th {...getColumnProps(0)} className="list-select-cell">
                <input
                  type="checkbox"
                  aria-label="Select all jobs"
                  checked={allSelected && jobList.length > 0}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected && !allSelected;
                  }}
                  onChange={toggleAll}
                  onClick={(e) => e.stopPropagation()}
                />
              </th>
              <th {...getColumnProps(1)}>Company<ResizeHandle index={1} /></th>
              <th {...getColumnProps(2)}>Job Title<ResizeHandle index={2} /></th>
              <th {...getColumnProps(3)}>Location<ResizeHandle index={3} /></th>
              <th {...getColumnProps(4)}>Type<ResizeHandle index={4} /></th>
              <th {...getColumnProps(5)}>Salary<ResizeHandle index={5} /></th>
              {isCandidate && (
                <th {...getColumnProps(6)}>Match<ResizeHandle index={6} /></th>
              )}
              {isStaff && (
                <th {...getColumnProps(6)} title="Distinct candidates with a stored match / all active candidates">
                  Match coverage<ResizeHandle index={6} />
                </th>
              )}
              {isStaff && (
                <th {...getColumnProps(7)} title="Where this job is published">
                  Listing<ResizeHandle index={7} />
                </th>
              )}
              <th {...getColumnProps(isStaff ? 8 : isCandidate ? 6 : 6)} className="col-status">
                Status
                <ResizeHandle index={isStaff ? 8 : isCandidate ? 6 : 6} />
              </th>
              {isStaff && (
                <th {...getColumnProps(9)} className="col-actions">
                  Actions
                  <ResizeHandle index={9} />
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {jobList.length > 0 ? (
              jobList.map((job) => (
                <tr 
                  key={job.id} 
                  className={`job-row${isSelected(job.id) ? ' row-selected' : ''}`}
                  onClick={() => handleJobClick(job)}
                >
                  <td className="list-select-cell" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${job.title}`}
                      checked={isSelected(job.id)}
                      onChange={() => toggleOne(job.id)}
                    />
                  </td>
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
                  {isStaff && (
                    <td onClick={(e) => e.stopPropagation()}>
                      <select
                        className="listing-type-select"
                        value={job.listing_type || 'internal'}
                        onChange={(e) =>
                          listingTypeMutation.mutate({ id: job.id, listing_type: e.target.value })
                        }
                        disabled={listingTypeMutation.isLoading && listingTypeMutation.variables?.id === job.id}
                        aria-label={`Listing type for ${job.title}`}
                      >
                        {LISTING_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </td>
                  )}
                  <td className="col-status">
                    <span
                      className={`badge badge-${job.status === 'active' ? 'success' : job.status === 'closed' ? 'warning' : job.status === 'draft' ? 'info' : 'danger'}`}
                    >
                      {job.status}
                    </span>
                    {isStaff && job.listing_type === 'web' && (
                      <span className={`badge badge-${listingTypeBadgeClass('web')}`} style={{ marginLeft: 6 }}>
                        Career site
                      </span>
                    )}
                  </td>
                  {isStaff && (
                    <td className="col-actions" onClick={(e) => e.stopPropagation()}>
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
                        AI match
                      </button>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={isCandidate ? 8 : isStaff ? 10 : 7} className="empty-state">
                  {isCandidate ? 'No matched jobs yet. An admin can run AI matching in Settings.' : 'No jobs found'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <JobFormModal
        open={showPostJobModal}
        onClose={() => setShowPostJobModal(false)}
      />
    </div>
  );
};

export default Jobs;

