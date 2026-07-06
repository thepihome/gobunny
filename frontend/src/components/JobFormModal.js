import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import api from '../config/api';
import { FiBriefcase, FiLink, FiSave, FiX } from 'react-icons/fi';
import LoadingButton from './LoadingButton';
import Modal from './Modal';
import { LISTING_TYPE_OPTIONS } from '../utils/listingType';
import '../pages/Jobs.css';

const EMPTY_FORM = {
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
  listing_type: 'internal',
};

function jobToForm(job) {
  if (!job) return { ...EMPTY_FORM };
  return {
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
    listing_type: job.listing_type || 'internal',
  };
}

export default function JobFormModal({ open, onClose, job = null, onSuccess }) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(job?.id);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const { data: jobRoles = [] } = useQuery(
    ['job-roles'],
    () => api.get('/job-roles').then((res) => res.data),
    { enabled: open }
  );

  useEffect(() => {
    if (open) {
      setFormData(jobToForm(job));
    }
  }, [open, job]);

  const invalidateJobs = () => {
    queryClient.invalidateQueries('jobs');
    if (job?.id) {
      queryClient.invalidateQueries(['job', String(job.id)]);
    }
  };

  const createMutation = useMutation((data) => api.post('/jobs', data), {
    onSuccess: () => {
      invalidateJobs();
      onSuccess?.();
      onClose();
    },
  });

  const updateMutation = useMutation(
    ({ id, data }) => api.put(`/jobs/${id}`, data),
    {
      onSuccess: () => {
        invalidateJobs();
        onSuccess?.();
        onClose();
      },
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    const submitData = {
      ...formData,
      salary_min: formData.salary_min ? parseInt(formData.salary_min, 10) : null,
      salary_max: formData.salary_max ? parseInt(formData.salary_max, 10) : null,
      required_skills: formData.required_skills
        ? formData.required_skills.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
      preferred_skills: formData.preferred_skills
        ? formData.preferred_skills.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
    };

    if (isEdit) {
      updateMutation.mutate({ id: job.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  if (!open) return null;

  const isSaving = createMutation.isLoading || updateMutation.isLoading;

  return (
    <Modal
      open={open}
      onClose={onClose}
      contentClassName="post-job-modal"
      ariaLabel={isEdit ? 'Edit job' : 'Post new job'}
    >
      <div className="modal-header">
        <h2>
          <FiBriefcase aria-hidden /> {isEdit ? 'Edit Job' : 'Post New Job'}
        </h2>
        <button type="button" className="btn-close-modal" onClick={onClose} aria-label="Close">
          <FiX />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="post-job-form">
          <div className="form-section">
            <h3>Basic Information</h3>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="job-form-company">Company *</label>
                <input
                  id="job-form-company"
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  placeholder="Company name"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="job-form-title">Job Title *</label>
                <input
                  id="job-form-title"
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Senior Software Engineer"
                  required
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="job-form-classification">Job Classification</label>
                <select
                  id="job-form-classification"
                  value={formData.job_classification || ''}
                  onChange={(e) => setFormData({ ...formData, job_classification: e.target.value })}
                >
                  <option value="">Select a job classification</option>
                  {jobRoles
                    .filter((role) => role.is_active === 1 || role.is_active === true)
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
                <label htmlFor="job-form-location">Location</label>
                <input
                  id="job-form-location"
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g., San Francisco, CA or Remote"
                />
              </div>
              <div className="form-group">
                <label htmlFor="job-form-employment">Employment Type</label>
                <select
                  id="job-form-employment"
                  value={formData.employment_type}
                  onChange={(e) => setFormData({ ...formData, employment_type: e.target.value })}
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
              <label htmlFor="job-form-description">Job Description *</label>
              <textarea
                id="job-form-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
                <label htmlFor="job-form-salary-min">Minimum Salary</label>
                <input
                  id="job-form-salary-min"
                  type="number"
                  value={formData.salary_min}
                  onChange={(e) => setFormData({ ...formData, salary_min: e.target.value })}
                  placeholder="e.g., 80000"
                  min="0"
                />
              </div>
              <div className="form-group">
                <label htmlFor="job-form-salary-max">Maximum Salary</label>
                <input
                  id="job-form-salary-max"
                  type="number"
                  value={formData.salary_max}
                  onChange={(e) => setFormData({ ...formData, salary_max: e.target.value })}
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
              <label htmlFor="job-form-experience">Experience Level</label>
              <select
                id="job-form-experience"
                value={formData.experience_level}
                onChange={(e) => setFormData({ ...formData, experience_level: e.target.value })}
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
              <label htmlFor="job-form-required-skills">Required Skills *</label>
              <input
                id="job-form-required-skills"
                type="text"
                value={formData.required_skills}
                onChange={(e) => setFormData({ ...formData, required_skills: e.target.value })}
                placeholder="Comma-separated: JavaScript, React, Node.js"
                required
              />
              <p className="form-hint">Separate multiple skills with commas</p>
            </div>
            <div className="form-group">
              <label htmlFor="job-form-preferred-skills">Preferred Skills</label>
              <input
                id="job-form-preferred-skills"
                type="text"
                value={formData.preferred_skills}
                onChange={(e) => setFormData({ ...formData, preferred_skills: e.target.value })}
                placeholder="Comma-separated: TypeScript, AWS, Docker"
              />
              <p className="form-hint">Optional skills that would be nice to have</p>
            </div>
          </div>

          <div className="form-section">
            <h3>Application</h3>
            <div className="form-group">
              <label htmlFor="job-form-apply-link">
                <FiLink /> External Apply Link
              </label>
              <input
                id="job-form-apply-link"
                type="url"
                value={formData.external_apply_link}
                onChange={(e) => setFormData({ ...formData, external_apply_link: e.target.value })}
                placeholder="https://company.com/careers/apply"
              />
              <p className="form-hint">Link to external job application page (optional)</p>
            </div>
            <div className="form-group">
              <label htmlFor="job-form-listing-type">Listing visibility</label>
              <select
                id="job-form-listing-type"
                value={formData.listing_type}
                onChange={(e) => setFormData({ ...formData, listing_type: e.target.value })}
              >
                {LISTING_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <p className="form-hint">
                Internal = GoDash only · Web = public career site · External = scanned portal jobs
              </p>
            </div>
            <div className="form-group">
              <label htmlFor="job-form-status">Status</label>
              <select
                id="job-form-status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <LoadingButton
              type="submit"
              className="btn btn-primary"
              icon={FiSave}
              loading={isSaving}
              loadingLabel={isEdit ? 'Updating…' : 'Posting…'}
            >
              {isEdit ? 'Update Job' : 'Post Job'}
            </LoadingButton>
          </div>
        </form>
    </Modal>
  );
}
