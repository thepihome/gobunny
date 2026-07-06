import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../config/api';
import { extractTextFromFile } from '../utils/resumeExtract';
import { FiUpload, FiTrash2, FiFileText, FiZap, FiEdit3, FiPlus } from 'react-icons/fi';
import './Resumes.css';
import './ResumeStudio.css';
import LoadingButton from '../components/LoadingButton';
import IconButton from '../components/IconButton';
import Modal from '../components/Modal';

const Resumes = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [formData, setFormData] = useState({
    skills: '',
    experience_years: '',
    education: '',
    summary: '',
  });
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [storeInR2, setStoreInR2] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractPreview, setExtractPreview] = useState('');

  const { data: resumes, isLoading } = useQuery(
    'my-resumes',
    () => api.get('/resumes/my-resumes').then(res => res.data)
  );

  const uploadMutation = useMutation(
    async (data) => {
      const fd = new FormData();
      fd.append('resume', data.file);
      if (data.contentText) fd.append('content_text', data.contentText);
      fd.append('store_file', data.storeInR2 ? 'true' : 'false');
      fd.append('skills', JSON.stringify(data.skills.split(',').map(s => s.trim()).filter(s => s)));
      fd.append('experience_years', data.experience_years);
      fd.append('education', data.education);
      fd.append('summary', data.summary);
      return api.post('/resumes/upload', fd);
    },
    {
      onSuccess: (res) => {
        queryClient.invalidateQueries('my-resumes');
        setShowUploadModal(false);
        setFile(null);
        setExtractPreview('');
        setFormData({ skills: '', experience_years: '', education: '', summary: '' });
        navigate(`/resumes/${res.data.id}/studio`);
      },
    }
  );

  const createBlankMutation = useMutation(
    () =>
      api.post('/resumes/create-text', {
        file_name: 'New Resume',
        structured_content: {
          contact: { name: '', email: '', phone: '', linkedin: '' },
          summary: '',
          experience: [],
          education: [],
          skills: [],
          certifications: [],
        },
      }),
    {
      onSuccess: (res) => {
        queryClient.invalidateQueries('my-resumes');
        navigate(`/resumes/${res.data.id}/studio`);
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

  const handleFileChange = async (e) => {
    const selected = e.target.files[0];
    setFile(selected);
    setExtractPreview('');
    if (!selected) return;
    setExtracting(true);
    try {
      const text = await extractTextFromFile(selected);
      setExtractPreview(text.slice(0, 200) + (text.length > 200 ? '…' : ''));
    } catch (err) {
      setExtractPreview(`Could not extract text: ${err.message}. You can still upload and parse in Resume Studio.`);
    } finally {
      setExtracting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      alert('Please select a file');
      return;
    }
    let contentText = '';
    try {
      contentText = await extractTextFromFile(file);
    } catch {
      contentText = '';
    }
    uploadMutation.mutate({ ...formData, file, contentText, storeInR2 });
  };

  if (isLoading) {
    return <div className="loading">Loading resumes...</div>;
  }

  return (
    <div className="resumes-page list-page">
      <div className="page-header">
        <h1>My Resumes</h1>
        <div className="list-page-header-actions page-toolbar">
          <IconButton
            icon={FiPlus}
            label="New resume in editor"
            onClick={() => createBlankMutation.mutate()}
            loading={createBlankMutation.isLoading}
          />
          <IconButton
            icon={FiUpload}
            label="Upload resume"
            variant="primary"
            onClick={() => setShowUploadModal(true)}
          />
        </div>
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
                    Updated: {new Date(resume.updated_at || resume.uploaded_at).toLocaleDateString()}
                    {resume.content_text && (
                      <span className="ats-badge"> · Parsed in D1</span>
                    )}
                    {!resume.file_path && (
                      <span className="ats-badge"> · Editor-only</span>
                    )}
                  </p>
                </div>
              </div>
              {resume.summary && <p className="resume-summary">{resume.summary}</p>}
              {resume.ai_insights?.last_analysis && (
                <p className="resume-summary">
                  AI score: {resume.ai_insights.last_analysis.overall_score}/100 ATS ·{' '}
                  {resume.ai_insights.last_analysis.ats_score}/100
                </p>
              )}
              {resume.skills && resume.skills.length > 0 && (
                <div className="resume-skills">
                  {resume.skills.slice(0, 8).map((skill, idx) => (
                    <span key={idx} className="skill-tag">{skill}</span>
                  ))}
                </div>
              )}
              <div className="resume-card-actions">
                <Link to={`/resumes/${resume.id}/studio`} className="btn btn-primary btn-sm">
                  <FiEdit3 /> Open Studio
                </Link>
                <Link to={`/resumes/${resume.id}/studio`} className="btn btn-secondary btn-sm">
                  <FiZap /> Analyze & match
                </Link>
                <button
                  onClick={() => deleteMutation.mutate(resume.id)}
                  className="btn btn-danger btn-sm"
                >
                  <FiTrash2 /> Delete
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <p>No resumes yet. Upload a PDF/DOCX or start from scratch in the editor.</p>
            <p className="parse-status">Tip: We extract text locally and save it in the database for faster AI scoring.</p>
          </div>
        )}
      </div>

      <Modal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        ariaLabel="Upload resume"
      >
        <h2>Upload Resume</h2>
        <p className="form-hint">
          Text is extracted in your browser and saved to the database. Original files are optional.
        </p>
        <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Resume File (PDF, DOC, DOCX)</label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileChange}
                  required
                />
                {extracting && <p className="parse-status">Extracting text…</p>}
                {extractPreview && !extracting && (
                  <p className="parse-status">Preview: {extractPreview}</p>
                )}
              </div>
              <div className="upload-options">
                <label>
                  <input
                    type="checkbox"
                    checked={storeInR2}
                    onChange={(e) => setStoreInR2(e.target.checked)}
                  />
                  Also keep original file in cloud storage (optional backup for download)
                </label>
              </div>
              <div className="form-group">
                <label>Skills (comma-separated, optional)</label>
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
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowUploadModal(false)}
                >
                  Cancel
                </button>
                <LoadingButton type="submit" className="btn btn-primary" icon={FiUpload} loading={uploadMutation.isLoading} loadingLabel="Uploading...">
                  Upload & open Studio
                </LoadingButton>
              </div>
            </form>
      </Modal>
    </div>
  );
};

export default Resumes;
