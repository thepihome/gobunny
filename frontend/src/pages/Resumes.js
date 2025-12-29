import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../config/api';
import { FiUpload, FiTrash2, FiFileText } from 'react-icons/fi';
import './Resumes.css';

const Resumes = () => {
  const queryClient = useQueryClient();
  const [file, setFile] = useState(null);
  const [formData, setFormData] = useState({
    skills: '',
    experience_years: '',
    education: '',
    summary: '',
  });
  const [showUploadModal, setShowUploadModal] = useState(false);

  const { data: resumes, isLoading } = useQuery(
    'my-resumes',
    () => api.get('/resumes/my-resumes').then(res => res.data)
  );

  const uploadMutation = useMutation(
    async (data) => {
      const formData = new FormData();
      formData.append('resume', data.file);
      formData.append('skills', JSON.stringify(data.skills.split(',').map(s => s.trim()).filter(s => s)));
      formData.append('experience_years', data.experience_years);
      formData.append('education', data.education);
      formData.append('summary', data.summary);
      return api.post('/resumes/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('my-resumes');
        setShowUploadModal(false);
        setFile(null);
        setFormData({ skills: '', experience_years: '', education: '', summary: '' });
      },
    }
  );

  const deleteMutation = useMutation(
    (id) => api.delete(`/resumes/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('my-resumes');
      },
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!file) {
      alert('Please select a file');
      return;
    }
    uploadMutation.mutate({ ...formData, file });
  };

  if (isLoading) {
    return <div className="loading">Loading resumes...</div>;
  }

  return (
    <div className="resumes-page">
      <div className="page-header">
        <h1>My Resumes</h1>
        <button className="btn btn-primary" onClick={() => setShowUploadModal(true)}>
          <FiUpload /> Upload Resume
        </button>
      </div>

      <div className="resumes-list">
        {resumes && resumes.length > 0 ? (
          resumes.map((resume) => (
            <div key={resume.id} className="resume-card">
              <div className="resume-header">
                <FiFileText size={24} />
                <div>
                  <h3>{resume.file_name || `Resume ${resume.id}`}</h3>
                  <p className="resume-date">
                    Uploaded: {new Date(resume.uploaded_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              {resume.summary && <p className="resume-summary">{resume.summary}</p>}
              {resume.skills && resume.skills.length > 0 && (
                <div className="resume-skills">
                  {resume.skills.map((skill, idx) => (
                    <span key={idx} className="skill-tag">{skill}</span>
                  ))}
                </div>
              )}
              {resume.experience_years && (
                <p className="resume-experience">Experience: {resume.experience_years} years</p>
              )}
              <button
                onClick={() => deleteMutation.mutate(resume.id)}
                className="btn btn-danger btn-sm"
              >
                <FiTrash2 /> Delete
              </button>
            </div>
          ))
        ) : (
          <div className="empty-state">No resumes uploaded yet</div>
        )}
      </div>

      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Upload Resume</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Resume File (PDF, DOC, DOCX)</label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setFile(e.target.files[0])}
                  required
                />
              </div>
              <div className="form-group">
                <label>Skills (comma-separated)</label>
                <input
                  type="text"
                  value={formData.skills}
                  onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                  placeholder="JavaScript, React, Node.js"
                />
              </div>
              <div className="form-group">
                <label>Years of Experience</label>
                <input
                  type="number"
                  value={formData.experience_years}
                  onChange={(e) => setFormData({ ...formData, experience_years: e.target.value })}
                  min="0"
                />
              </div>
              <div className="form-group">
                <label>Education</label>
                <input
                  type="text"
                  value={formData.education}
                  onChange={(e) => setFormData({ ...formData, education: e.target.value })}
                  placeholder="Bachelor's in Computer Science"
                />
              </div>
              <div className="form-group">
                <label>Summary</label>
                <textarea
                  value={formData.summary}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                  placeholder="Brief professional summary"
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowUploadModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={uploadMutation.isLoading}>
                  {uploadMutation.isLoading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Resumes;


