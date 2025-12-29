import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import api from '../config/api';
import { useAuth } from '../context/AuthContext';
import { FiPlus, FiUser, FiMail, FiPhone, FiTrash2, FiX } from 'react-icons/fi';
import './Candidates.css';

const Candidates = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [candidateFormData, setCandidateFormData] = useState({
    // User fields
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: '',
    // Profile fields
    date_of_birth: '',
    address: '',
    city: '',
    state: '',
    country: '',
    zip_code: '',
    linkedin_url: '',
    portfolio_url: '',
    github_url: '',
    current_job_title: '',
    current_company: '',
    years_of_experience: '',
    availability: 'available',
    expected_salary_min: '',
    expected_salary_max: '',
    work_authorization: '',
    willing_to_relocate: false,
    preferred_locations: '',
    summary: '',
    additional_notes: '',
  });
  const [resumeFiles, setResumeFiles] = useState([]);
  const [resumeData, setResumeData] = useState([
    { skills: '', experience_years: '', education: '', summary: '' },
    { skills: '', experience_years: '', education: '', summary: '' },
    { skills: '', experience_years: '', education: '', summary: '' },
  ]);

  // Get candidates based on role
  const { data: candidates, isLoading } = useQuery(
    ['candidates', user?.role],
    () => {
      if (user?.role === 'admin') {
        return api.get('/candidates').then(res => res.data);
      } else {
        return api.get('/candidates/assigned').then(res => res.data);
      }
    }
  );

  const updateCandidateMutation = useMutation(
    async ({ candidateId, candidateData, resumes, existingResumeIds }) => {
      // Update the user
      await api.put(`/users/${candidateId}`, {
        email: candidateData.email,
        first_name: candidateData.first_name,
        last_name: candidateData.last_name,
        role: 'candidate',
        phone: candidateData.phone,
      });

      // Update password if provided
      if (candidateData.password) {
        await api.put(`/users/${candidateId}/password`, {
          password: candidateData.password,
        });
      }

      const userId = candidateId;

      // Update or create the profile
      const profileData = {
        user_id: userId,
        date_of_birth: candidateData.date_of_birth || null,
        address: candidateData.address || null,
        city: candidateData.city || null,
        state: candidateData.state || null,
        country: candidateData.country || null,
        zip_code: candidateData.zip_code || null,
        linkedin_url: candidateData.linkedin_url || null,
        portfolio_url: candidateData.portfolio_url || null,
        github_url: candidateData.github_url || null,
        current_job_title: candidateData.current_job_title || null,
        current_company: candidateData.current_company || null,
        years_of_experience: candidateData.years_of_experience ? parseInt(candidateData.years_of_experience) : null,
        availability: candidateData.availability || null,
        expected_salary_min: candidateData.expected_salary_min ? parseInt(candidateData.expected_salary_min) : null,
        expected_salary_max: candidateData.expected_salary_max ? parseInt(candidateData.expected_salary_max) : null,
        work_authorization: candidateData.work_authorization || null,
        willing_to_relocate: candidateData.willing_to_relocate || false,
        preferred_locations: candidateData.preferred_locations ? candidateData.preferred_locations.split(',').map(l => l.trim()).filter(l => l) : [],
        summary: candidateData.summary || null,
        additional_notes: candidateData.additional_notes || null,
      };

      // The endpoint handles both create and update
      await api.post('/candidate-profiles', profileData);

      // Handle resumes
      for (let i = 0; i < resumes.length; i++) {
        const resume = resumes[i];
        
        if (resume.id && resume.file) {
          // Replace existing resume: delete old one and upload new one
          await api.delete(`/resumes/${resume.id}`);
          const formData = new FormData();
          formData.append('resume', resume.file);
          formData.append('skills', JSON.stringify(resume.skills ? resume.skills.split(',').map(s => s.trim()).filter(s => s) : []));
          formData.append('experience_years', resume.experience_years || '');
          formData.append('education', resume.education || '');
          formData.append('summary', resume.summary || '');

          await api.post(`/resumes/upload-for-candidate/${userId}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } else if (resume.id && !resume.file) {
          // Update existing resume metadata only
          await api.put(`/resumes/${resume.id}`, {
            skills: resume.skills ? resume.skills.split(',').map(s => s.trim()).filter(s => s) : [],
            experience_years: resume.experience_years ? parseInt(resume.experience_years) : null,
            education: resume.education || '',
            summary: resume.summary || '',
          });
        } else if (!resume.id && resume.file) {
          // Upload new resume
          const formData = new FormData();
          formData.append('resume', resume.file);
          formData.append('skills', JSON.stringify(resume.skills ? resume.skills.split(',').map(s => s.trim()).filter(s => s) : []));
          formData.append('experience_years', resume.experience_years || '');
          formData.append('education', resume.education || '');
          formData.append('summary', resume.summary || '');

          await api.post(`/resumes/upload-for-candidate/${userId}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        }
      }

      return { id: userId };
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('candidates');
        setShowEditModal(false);
        setEditingCandidate(null);
        resetForm();
      },
    }
  );

  const createCandidateMutation = useMutation(
    async ({ candidateData, resumes }) => {
      // First create the user
      const userResponse = await api.post('/users', {
        email: candidateData.email,
        password: candidateData.password,
        first_name: candidateData.first_name,
        last_name: candidateData.last_name,
        role: 'candidate',
        phone: candidateData.phone,
      });

      const userId = userResponse.data.id;

      // Then create the profile if there's any profile data
      const profileData = {
        user_id: userId,
        date_of_birth: candidateData.date_of_birth || null,
        address: candidateData.address || null,
        city: candidateData.city || null,
        state: candidateData.state || null,
        country: candidateData.country || null,
        zip_code: candidateData.zip_code || null,
        linkedin_url: candidateData.linkedin_url || null,
        portfolio_url: candidateData.portfolio_url || null,
        github_url: candidateData.github_url || null,
        current_job_title: candidateData.current_job_title || null,
        current_company: candidateData.current_company || null,
        years_of_experience: candidateData.years_of_experience ? parseInt(candidateData.years_of_experience) : null,
        availability: candidateData.availability || null,
        expected_salary_min: candidateData.expected_salary_min ? parseInt(candidateData.expected_salary_min) : null,
        expected_salary_max: candidateData.expected_salary_max ? parseInt(candidateData.expected_salary_max) : null,
        work_authorization: candidateData.work_authorization || null,
        willing_to_relocate: candidateData.willing_to_relocate || false,
        preferred_locations: candidateData.preferred_locations ? candidateData.preferred_locations.split(',').map(l => l.trim()).filter(l => l) : [],
        summary: candidateData.summary || null,
        additional_notes: candidateData.additional_notes || null,
      };

      // Only create profile if there's at least one field filled
      const hasProfileData = Object.values(profileData).some((val, idx) => {
        if (idx === 0) return false; // Skip user_id
        return val !== null && val !== false && val !== '';
      });

      if (hasProfileData) {
        await api.post('/candidate-profiles', profileData);
      }

      // Upload resumes if any
      if (resumes && resumes.length > 0) {
        for (let i = 0; i < resumes.length; i++) {
          const resume = resumes[i];
          if (resume.file) {
            const formData = new FormData();
            formData.append('resume', resume.file);
            formData.append('skills', JSON.stringify(resume.skills ? resume.skills.split(',').map(s => s.trim()).filter(s => s) : []));
            formData.append('experience_years', resume.experience_years || '');
            formData.append('education', resume.education || '');
            formData.append('summary', resume.summary || '');

            await api.post(`/resumes/upload-for-candidate/${userId}`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });
          }
        }
      }

      return userResponse.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('candidates');
        setShowAddModal(false);
        resetForm();
      },
    }
  );

  const resetForm = () => {
    setCandidateFormData({
      email: '',
      password: '',
      first_name: '',
      last_name: '',
      phone: '',
      date_of_birth: '',
      address: '',
      city: '',
      state: '',
      country: '',
      zip_code: '',
      linkedin_url: '',
      portfolio_url: '',
      github_url: '',
      current_job_title: '',
      current_company: '',
      years_of_experience: '',
      availability: 'available',
      expected_salary_min: '',
      expected_salary_max: '',
      work_authorization: '',
      willing_to_relocate: false,
      preferred_locations: '',
      summary: '',
      additional_notes: '',
    });
    setResumeFiles([]);
    setResumeData([
      { skills: '', experience_years: '', education: '', summary: '' },
      { skills: '', experience_years: '', education: '', summary: '' },
      { skills: '', experience_years: '', education: '', summary: '' },
    ]);
  };

  const handleAddCandidate = (e) => {
    e.preventDefault();
    
    // Prepare resume data - only include resumes with files
    const resumes = resumeFiles
      .map((file, index) => file ? {
        file: file,
        ...resumeData[index],
      } : null)
      .filter(resume => resume !== null);

    createCandidateMutation.mutate({
      candidateData: candidateFormData,
      resumes: resumes,
    });
  };

  const handleUpdateCandidate = (e) => {
    e.preventDefault();
    
    // Prepare resume data
    const resumes = resumeFiles.map((file, index) => {
      const data = resumeData[index];
      return {
        id: data.id, // Existing resume ID if editing
        file: file, // New file if replacing
        ...data,
      };
    }).filter(resume => resume.file || resume.id); // Include if has file or is existing

    const existingResumeIds = resumes.filter(r => r.id && !r.file).map(r => r.id);

    updateCandidateMutation.mutate({
      candidateId: editingCandidate.id,
      candidateData: candidateFormData,
      resumes: resumes,
      existingResumeIds: existingResumeIds,
    });
  };

  const handleResumeFileChange = (index, file) => {
    const newFiles = [...resumeFiles];
    newFiles[index] = file;
    setResumeFiles(newFiles);
  };

  const handleResumeDataChange = (index, field, value) => {
    const newResumeData = [...resumeData];
    newResumeData[index] = {
      ...newResumeData[index],
      [field]: value,
    };
    setResumeData(newResumeData);
  };

  const removeResume = (index) => {
    const newFiles = [...resumeFiles];
    const newResumeData = [...resumeData];
    newFiles[index] = null;
    newResumeData[index] = { skills: '', experience_years: '', education: '', summary: '' };
    setResumeFiles(newFiles);
    setResumeData(newResumeData);
  };

  const handleCandidateClick = (candidate) => {
    navigate(`/candidates/${candidate.id}`);
  };

  if (isLoading) {
    return <div className="loading">Loading candidates...</div>;
  }

  return (
    <div className="candidates-page">
      <div className="page-header">
        <h1>{user?.role === 'admin' ? 'All Candidates' : 'Assigned Candidates'}</h1>
        {user?.role === 'admin' && (
          <button 
            className="btn btn-primary"
            onClick={() => setShowAddModal(true)}
          >
            <FiPlus /> Add Candidate
          </button>
        )}
      </div>

      <div className="candidates-table-container">
        <table className="table candidates-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Current Position</th>
              <th>Experience</th>
              <th>Resumes</th>
              <th>Matches</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {candidates && candidates.length > 0 ? (
              candidates.map((candidate) => (
                <tr 
                  key={candidate.id} 
                  className="candidate-row"
                  onClick={() => handleCandidateClick(candidate)}
                >
                  <td>
                    <div className="candidate-name-cell">
                      <FiUser className="candidate-icon" />
                      <strong>{candidate.first_name} {candidate.last_name}</strong>
                    </div>
                  </td>
                  <td>
                    <span className="candidate-email-inline">
                      <FiMail /> {candidate.email}
                    </span>
                  </td>
                  <td>
                    {candidate.phone ? (
                      <span className="candidate-phone-inline">
                        <FiPhone /> {candidate.phone}
                      </span>
                    ) : (
                      'N/A'
                    )}
                  </td>
                  <td>
                    {candidate.current_job_title ? (
                      <div className="candidate-position">
                        <div><strong>{candidate.current_job_title}</strong></div>
                        {candidate.current_company && (
                          <div className="candidate-company">{candidate.current_company}</div>
                        )}
                      </div>
                    ) : (
                      'N/A'
                    )}
                  </td>
                  <td>
                    {candidate.years_of_experience ? (
                      <span>{candidate.years_of_experience} years</span>
                    ) : (
                      'N/A'
                    )}
                  </td>
                  <td>
                    <span className="candidate-stat">{candidate.resume_count || 0}</span>
                  </td>
                  <td>
                    <span className="candidate-stat">{candidate.match_count || 0}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className={`badge badge-${candidate.is_active ? 'success' : 'danger'}`}>
                        {candidate.is_active ? 'Active' : 'Inactive'}
                      </span>
                      {candidate.assignment_status && (
                        <span className={`badge badge-info`}>
                          {candidate.assignment_status}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="empty-state">
                  {user?.role === 'admin' ? 'No candidates found' : 'No candidates assigned'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Candidate Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content add-candidate-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <FiUser /> Add New Candidate
              </h2>
              <button
                className="btn-close-modal"
                onClick={() => setShowAddModal(false)}
              >
                <FiX />
              </button>
            </div>

            <form onSubmit={handleAddCandidate} className="add-candidate-form">
              <div className="form-section">
                <h3>Basic Information</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>First Name *</label>
                    <input
                      type="text"
                      value={candidateFormData.first_name}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, first_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Last Name *</label>
                    <input
                      type="text"
                      value={candidateFormData.last_name}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, last_name: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Email *</label>
                    <input
                      type="email"
                      value={candidateFormData.email}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input
                      type="tel"
                      value={candidateFormData.phone}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Password *</label>
                    <input
                      type="password"
                      value={candidateFormData.password}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, password: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Date of Birth</label>
                    <input
                      type="date"
                      value={candidateFormData.date_of_birth}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, date_of_birth: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Address</h3>
                <div className="form-group">
                  <label>Street Address</label>
                  <input
                    type="text"
                    value={candidateFormData.address}
                    onChange={(e) => setCandidateFormData({ ...candidateFormData, address: e.target.value })}
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>City</label>
                    <input
                      type="text"
                      value={candidateFormData.city}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, city: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>State/Province</label>
                    <input
                      type="text"
                      value={candidateFormData.state}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, state: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Country</label>
                    <input
                      type="text"
                      value={candidateFormData.country}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, country: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Zip/Postal Code</label>
                    <input
                      type="text"
                      value={candidateFormData.zip_code}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, zip_code: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Professional Information</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Current Job Title</label>
                    <input
                      type="text"
                      value={candidateFormData.current_job_title}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, current_job_title: e.target.value })}
                      placeholder="e.g., Software Engineer"
                    />
                  </div>
                  <div className="form-group">
                    <label>Current Company</label>
                    <input
                      type="text"
                      value={candidateFormData.current_company}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, current_company: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Years of Experience</label>
                    <input
                      type="number"
                      value={candidateFormData.years_of_experience}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, years_of_experience: e.target.value })}
                      min="0"
                    />
                  </div>
                  <div className="form-group">
                    <label>Availability</label>
                    <select
                      value={candidateFormData.availability}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, availability: e.target.value })}
                    >
                      <option value="available">Available Immediately</option>
                      <option value="2-weeks">Available in 2 Weeks</option>
                      <option value="1-month">Available in 1 Month</option>
                      <option value="2-months">Available in 2 Months</option>
                      <option value="3-months">Available in 3+ Months</option>
                      <option value="not-available">Not Available</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Professional Summary</label>
                  <textarea
                    value={candidateFormData.summary}
                    onChange={(e) => setCandidateFormData({ ...candidateFormData, summary: e.target.value })}
                    rows="4"
                    placeholder="Brief professional summary..."
                  />
                </div>
              </div>

              <div className="form-section">
                <h3>Online Presence</h3>
                <div className="form-group">
                  <label>LinkedIn URL</label>
                  <input
                    type="url"
                    value={candidateFormData.linkedin_url}
                    onChange={(e) => setCandidateFormData({ ...candidateFormData, linkedin_url: e.target.value })}
                    placeholder="https://linkedin.com/in/username"
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Portfolio/Website URL</label>
                    <input
                      type="url"
                      value={candidateFormData.portfolio_url}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, portfolio_url: e.target.value })}
                      placeholder="https://yourportfolio.com"
                    />
                  </div>
                  <div className="form-group">
                    <label>GitHub URL</label>
                    <input
                      type="url"
                      value={candidateFormData.github_url}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, github_url: e.target.value })}
                      placeholder="https://github.com/username"
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Job Preferences</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Expected Salary Min</label>
                    <input
                      type="number"
                      value={candidateFormData.expected_salary_min}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, expected_salary_min: e.target.value })}
                      min="0"
                      placeholder="e.g., 80000"
                    />
                  </div>
                  <div className="form-group">
                    <label>Expected Salary Max</label>
                    <input
                      type="number"
                      value={candidateFormData.expected_salary_max}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, expected_salary_max: e.target.value })}
                      min="0"
                      placeholder="e.g., 120000"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Work Authorization</label>
                    <input
                      type="text"
                      value={candidateFormData.work_authorization}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, work_authorization: e.target.value })}
                      placeholder="e.g., US Citizen, H1B, Green Card"
                    />
                  </div>
                  <div className="form-group">
                    <label>Willing to Relocate</label>
                    <select
                      value={candidateFormData.willing_to_relocate ? 'yes' : 'no'}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, willing_to_relocate: e.target.value === 'yes' })}
                    >
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Preferred Locations</label>
                  <input
                    type="text"
                    value={candidateFormData.preferred_locations}
                    onChange={(e) => setCandidateFormData({ ...candidateFormData, preferred_locations: e.target.value })}
                    placeholder="Comma-separated: San Francisco, CA, New York, NY"
                  />
                  <p className="form-hint">Separate multiple locations with commas</p>
                </div>
              </div>

              <div className="form-section">
                <h3>Additional Notes</h3>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    value={candidateFormData.additional_notes}
                    onChange={(e) => setCandidateFormData({ ...candidateFormData, additional_notes: e.target.value })}
                    rows="3"
                    placeholder="Any additional notes about the candidate..."
                  />
                </div>
              </div>

              <div className="form-section">
                <h3>Resumes (Maximum 3)</h3>
                <p className="form-hint">You can upload up to 3 resumes for this candidate. Each resume can have additional details.</p>
                {[0, 1, 2].map((index) => (
                  <div key={index} className="resume-upload-item">
                    <div className="resume-upload-header">
                      <h4>Resume {index + 1}</h4>
                      {resumeFiles[index] && (
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => removeResume(index)}
                        >
                          <FiTrash2 /> Remove
                        </button>
                      )}
                    </div>
                    <div className="form-group">
                      <label>Resume File (PDF, DOC, DOCX)</label>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => {
                          if (e.target.files[0]) {
                            handleResumeFileChange(index, e.target.files[0]);
                          }
                        }}
                      />
                      {resumeFiles[index] && (
                        <p className="form-hint">Selected: {resumeFiles[index].name}</p>
                      )}
                    </div>
                    {resumeFiles[index] && (
                      <>
                        <div className="form-row">
                          <div className="form-group">
                            <label>Skills (comma-separated)</label>
                            <input
                              type="text"
                              value={resumeData[index].skills}
                              onChange={(e) => handleResumeDataChange(index, 'skills', e.target.value)}
                              placeholder="JavaScript, React, Node.js"
                            />
                          </div>
                          <div className="form-group">
                            <label>Years of Experience</label>
                            <input
                              type="number"
                              value={resumeData[index].experience_years}
                              onChange={(e) => handleResumeDataChange(index, 'experience_years', e.target.value)}
                              min="0"
                            />
                          </div>
                        </div>
                        <div className="form-group">
                          <label>Education</label>
                          <input
                            type="text"
                            value={resumeData[index].education}
                            onChange={(e) => handleResumeDataChange(index, 'education', e.target.value)}
                            placeholder="Bachelor's in Computer Science"
                          />
                        </div>
                        <div className="form-group">
                          <label>Summary</label>
                          <textarea
                            value={resumeData[index].summary}
                            onChange={(e) => handleResumeDataChange(index, 'summary', e.target.value)}
                            rows="2"
                            placeholder="Brief summary of this resume..."
                          />
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {resumeFiles.filter(f => f !== null && f !== undefined).length >= 3 && (
                  <p className="form-hint" style={{ color: '#28a745', fontWeight: 'bold' }}>
                    Maximum of 3 resumes reached
                  </p>
                )}
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createCandidateMutation.isLoading}
                >
                  {createCandidateMutation.isLoading ? 'Creating...' : 'Create Candidate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Candidate Modal */}
      {showEditModal && editingCandidate && (
        <div className="modal-overlay" onClick={() => { setShowEditModal(false); setEditingCandidate(null); resetForm(); }}>
          <div className="modal-content add-candidate-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <FiUser /> Edit Candidate: {editingCandidate.first_name} {editingCandidate.last_name}
              </h2>
              <button
                className="btn-close-modal"
                onClick={() => { setShowEditModal(false); setEditingCandidate(null); resetForm(); }}
              >
                <FiX />
              </button>
            </div>

            <form onSubmit={handleUpdateCandidate} className="add-candidate-form">
              <div className="form-section">
                <h3>Basic Information</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>First Name *</label>
                    <input
                      type="text"
                      value={candidateFormData.first_name}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, first_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Last Name *</label>
                    <input
                      type="text"
                      value={candidateFormData.last_name}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, last_name: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Email *</label>
                    <input
                      type="email"
                      value={candidateFormData.email}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input
                      type="tel"
                      value={candidateFormData.phone}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Password</label>
                    <input
                      type="password"
                      value={candidateFormData.password}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, password: e.target.value })}
                      placeholder="Leave blank to keep current password"
                    />
                    <p className="form-hint">Leave blank to keep current password</p>
                  </div>
                  <div className="form-group">
                    <label>Date of Birth</label>
                    <input
                      type="date"
                      value={candidateFormData.date_of_birth}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, date_of_birth: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Address</h3>
                <div className="form-group">
                  <label>Street Address</label>
                  <input
                    type="text"
                    value={candidateFormData.address}
                    onChange={(e) => setCandidateFormData({ ...candidateFormData, address: e.target.value })}
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>City</label>
                    <input
                      type="text"
                      value={candidateFormData.city}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, city: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>State/Province</label>
                    <input
                      type="text"
                      value={candidateFormData.state}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, state: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Country</label>
                    <input
                      type="text"
                      value={candidateFormData.country}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, country: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Zip/Postal Code</label>
                    <input
                      type="text"
                      value={candidateFormData.zip_code}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, zip_code: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Professional Information</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Current Job Title</label>
                    <input
                      type="text"
                      value={candidateFormData.current_job_title}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, current_job_title: e.target.value })}
                      placeholder="e.g., Software Engineer"
                    />
                  </div>
                  <div className="form-group">
                    <label>Current Company</label>
                    <input
                      type="text"
                      value={candidateFormData.current_company}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, current_company: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Years of Experience</label>
                    <input
                      type="number"
                      value={candidateFormData.years_of_experience}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, years_of_experience: e.target.value })}
                      min="0"
                    />
                  </div>
                  <div className="form-group">
                    <label>Availability</label>
                    <select
                      value={candidateFormData.availability}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, availability: e.target.value })}
                    >
                      <option value="available">Available Immediately</option>
                      <option value="2-weeks">Available in 2 Weeks</option>
                      <option value="1-month">Available in 1 Month</option>
                      <option value="2-months">Available in 2 Months</option>
                      <option value="3-months">Available in 3+ Months</option>
                      <option value="not-available">Not Available</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Professional Summary</label>
                  <textarea
                    value={candidateFormData.summary}
                    onChange={(e) => setCandidateFormData({ ...candidateFormData, summary: e.target.value })}
                    rows="4"
                    placeholder="Brief professional summary..."
                  />
                </div>
              </div>

              <div className="form-section">
                <h3>Online Presence</h3>
                <div className="form-group">
                  <label>LinkedIn URL</label>
                  <input
                    type="url"
                    value={candidateFormData.linkedin_url}
                    onChange={(e) => setCandidateFormData({ ...candidateFormData, linkedin_url: e.target.value })}
                    placeholder="https://linkedin.com/in/username"
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Portfolio/Website URL</label>
                    <input
                      type="url"
                      value={candidateFormData.portfolio_url}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, portfolio_url: e.target.value })}
                      placeholder="https://yourportfolio.com"
                    />
                  </div>
                  <div className="form-group">
                    <label>GitHub URL</label>
                    <input
                      type="url"
                      value={candidateFormData.github_url}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, github_url: e.target.value })}
                      placeholder="https://github.com/username"
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Job Preferences</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Expected Salary Min</label>
                    <input
                      type="number"
                      value={candidateFormData.expected_salary_min}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, expected_salary_min: e.target.value })}
                      min="0"
                      placeholder="e.g., 80000"
                    />
                  </div>
                  <div className="form-group">
                    <label>Expected Salary Max</label>
                    <input
                      type="number"
                      value={candidateFormData.expected_salary_max}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, expected_salary_max: e.target.value })}
                      min="0"
                      placeholder="e.g., 120000"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Work Authorization</label>
                    <input
                      type="text"
                      value={candidateFormData.work_authorization}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, work_authorization: e.target.value })}
                      placeholder="e.g., US Citizen, H1B, Green Card"
                    />
                  </div>
                  <div className="form-group">
                    <label>Willing to Relocate</label>
                    <select
                      value={candidateFormData.willing_to_relocate ? 'yes' : 'no'}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, willing_to_relocate: e.target.value === 'yes' })}
                    >
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Preferred Locations</label>
                  <input
                    type="text"
                    value={candidateFormData.preferred_locations}
                    onChange={(e) => setCandidateFormData({ ...candidateFormData, preferred_locations: e.target.value })}
                    placeholder="Comma-separated: San Francisco, CA, New York, NY"
                  />
                  <p className="form-hint">Separate multiple locations with commas</p>
                </div>
              </div>

              <div className="form-section">
                <h3>Additional Notes</h3>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    value={candidateFormData.additional_notes}
                    onChange={(e) => setCandidateFormData({ ...candidateFormData, additional_notes: e.target.value })}
                    rows="3"
                    placeholder="Any additional notes about the candidate..."
                  />
                </div>
              </div>

              <div className="form-section">
                <h3>Resumes (Maximum 3)</h3>
                <p className="form-hint">You can update existing resumes or add new ones. Upload a new file to replace an existing resume.</p>
                {[0, 1, 2].map((index) => {
                  const existingResume = resumeData[index]?.id;
                  return (
                    <div key={index} className="resume-upload-item">
                      <div className="resume-upload-header">
                        <h4>Resume {index + 1} {existingResume && <span style={{ fontSize: '12px', color: '#666' }}>(Existing)</span>}</h4>
                        {resumeFiles[index] && (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => removeResume(index)}
                          >
                            <FiTrash2 /> Remove
                          </button>
                        )}
                        {existingResume && !resumeFiles[index] && (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={async () => {
                              if (window.confirm('Are you sure you want to delete this resume?')) {
                                try {
                                  await api.delete(`/resumes/${existingResume}`);
                                  const newResumeData = [...resumeData];
                                  const newResumeFiles = [...resumeFiles];
                                  newResumeData[index] = { skills: '', experience_years: '', education: '', summary: '' };
                                  newResumeFiles[index] = null;
                                  setResumeData(newResumeData);
                                  setResumeFiles(newResumeFiles);
                                  queryClient.invalidateQueries('candidates');
                                } catch (error) {
                                  alert('Failed to delete resume');
                                }
                              }
                            }}
                          >
                            <FiTrash2 /> Delete
                          </button>
                        )}
                      </div>
                      <div className="form-group">
                        <label>Resume File (PDF, DOC, DOCX) {existingResume && <span style={{ fontSize: '12px', color: '#666' }}>- Leave empty to keep current file</span>}</label>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx"
                          onChange={(e) => {
                            if (e.target.files[0]) {
                              handleResumeFileChange(index, e.target.files[0]);
                            }
                          }}
                        />
                        {resumeFiles[index] && (
                          <p className="form-hint">Selected: {resumeFiles[index].name}</p>
                        )}
                      </div>
                      {(resumeFiles[index] || existingResume) && (
                        <>
                          <div className="form-row">
                            <div className="form-group">
                              <label>Skills (comma-separated)</label>
                              <input
                                type="text"
                                value={resumeData[index].skills}
                                onChange={(e) => handleResumeDataChange(index, 'skills', e.target.value)}
                                placeholder="JavaScript, React, Node.js"
                              />
                            </div>
                            <div className="form-group">
                              <label>Years of Experience</label>
                              <input
                                type="number"
                                value={resumeData[index].experience_years}
                                onChange={(e) => handleResumeDataChange(index, 'experience_years', e.target.value)}
                                min="0"
                              />
                            </div>
                          </div>
                          <div className="form-group">
                            <label>Education</label>
                            <input
                              type="text"
                              value={resumeData[index].education}
                              onChange={(e) => handleResumeDataChange(index, 'education', e.target.value)}
                              placeholder="Bachelor's in Computer Science"
                            />
                          </div>
                          <div className="form-group">
                            <label>Summary</label>
                            <textarea
                              value={resumeData[index].summary}
                              onChange={(e) => handleResumeDataChange(index, 'summary', e.target.value)}
                              rows="2"
                              placeholder="Brief summary of this resume..."
                            />
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
                {resumeFiles.filter(f => f !== null && f !== undefined).length >= 3 && (
                  <p className="form-hint" style={{ color: '#28a745', fontWeight: 'bold' }}>
                    Maximum of 3 resumes reached
                  </p>
                )}
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => { setShowEditModal(false); setEditingCandidate(null); resetForm(); }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={updateCandidateMutation.isLoading}
                >
                  {updateCandidateMutation.isLoading ? 'Updating...' : 'Update Candidate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Candidates;

