import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../config/api';
import ResumeEditor, {
  suggestionToHighlightKey,
  applySuggestionToStructured,
} from '../components/ResumeEditor';
import { emptyStructuredContent } from '../utils/resumeExtract';
import LoadingButton from '../components/LoadingButton';
import {
  FiSave,
  FiZap,
  FiTarget,
  FiEdit3,
  FiArrowLeft,
  FiCheckCircle,
  FiAlertCircle,
} from 'react-icons/fi';
import './ResumeStudio.css';

function ScoreRing({ score, label }) {
  if (score == null || score === '') {
    return (
      <div className="score-ring score-ring-low">
        <span className="score-value">—</span>
        <span className="score-label">{label}</span>
      </div>
    );
  }
  const color = score >= 75 ? 'good' : score >= 50 ? 'mid' : 'low';
  return (
    <div className={`score-ring score-ring-${color}`}>
      <span className="score-value">{score}</span>
      <span className="score-label">{label}</span>
    </div>
  );
}

const ResumeStudio = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('fit');
  const [fileName, setFileName] = useState('');
  const [structured, setStructured] = useState(emptyStructuredContent());
  const [contentText, setContentText] = useState('');
  const [dirty, setDirty] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [fitResult, setFitResult] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(null);
  const [jobMode, setJobMode] = useState('list');
  const [selectedJobId, setSelectedJobId] = useState(searchParams.get('job_id') || '');
  const [pastedJd, setPastedJd] = useState('');
  const [message, setMessage] = useState('');
  const [aiBusy, setAiBusy] = useState(false);

  useEffect(() => {
    if (searchParams.get('job_id')) {
      setJobMode('list');
      setActiveTab('fit');
    }
  }, [searchParams]);

  const { data: resume, isLoading } = useQuery(
    ['resume', id],
    () => api.get(`/resumes/${id}`).then((res) => res.data),
    {
      onSuccess: (data) => {
        setFileName(data.file_name || 'My Resume');
        setStructured(data.structured_content || emptyStructuredContent());
        setContentText(data.content_text || '');
        if (data.ai_insights?.last_analysis) setAnalysis(data.ai_insights.last_analysis);
        if (data.ai_insights?.last_suggestions) setSuggestions(data.ai_insights.last_suggestions);
      },
    }
  );

  const { data: jobs } = useQuery(
    'job-opportunities',
    () => api.get('/jobs/opportunities').then((res) => res.data),
    { staleTime: 60000 }
  );

  const draftPayload = useCallback(
    () => ({
      structured_content: structured,
      content_text: contentText,
    }),
    [structured, contentText]
  );

  const jobContextPayload = useCallback(() => {
    const body = {};
    if (selectedJobId) body.job_id = Number(selectedJobId);
    else if (pastedJd.trim()) body.job_description = pastedJd;
    return body;
  }, [selectedJobId, pastedJd]);

  const fetchSuggestions = useCallback(
    async (extra = {}) => {
      const body = { ...draftPayload(), section: 'all', ...jobContextPayload(), ...extra };
      const res = await api.post(`/resumes/${id}/suggestions`, body);
      const list = res.data.suggestions || [];
      setSuggestions(list);
      if (list.length > 0) {
        setActiveSuggestionIdx(0);
        setActiveTab('fixes');
      }
      return list;
    },
    [draftPayload, jobContextPayload, id]
  );

  const saveMutation = useMutation(
    () =>
      api.put(`/resumes/${id}`, {
        file_name: fileName,
        structured_content: structured,
        content_text: contentText,
        skills: structured.skills,
        summary: structured.summary,
      }),
    {
      onSuccess: () => {
        setDirty(false);
        setMessage('Resume saved.');
        queryClient.invalidateQueries(['resume', id]);
        queryClient.invalidateQueries('my-resumes');
      },
      onError: (err) => setMessage(err.response?.data?.error || 'Save failed'),
    }
  );

  const parseMutation = useMutation(
    () => api.post(`/resumes/${id}/parse`, { content_text: contentText }),
    {
      onSuccess: (res) => {
        setStructured(res.data.structured_content || emptyStructuredContent());
        setContentText(res.data.content_text || '');
        setDirty(false);
        setMessage('Resume parsed into editable sections.');
        queryClient.invalidateQueries(['resume', id]);
      },
      onError: (err) => setMessage(err.response?.data?.error || 'Parse failed'),
    }
  );

  const runAnalyze = async () => {
    setAiBusy(true);
    try {
      const res = await api.post(`/resumes/${id}/analyze`, { ...draftPayload(), draft_only: false });
      const a = res.data.analysis;
      setAnalysis(a);
      const sugList = res.data.suggestions || [];
      if (sugList.length) {
        setSuggestions(sugList);
        setActiveSuggestionIdx(0);
        setActiveTab('fixes');
      } else {
        setActiveTab('analysis');
      }
      const list = sugList.length ? sugList : await fetchSuggestions();
      setMessage(
        list.length
          ? `Review complete (${a.overall_score}/100). ${list.length} fixes highlighted in editor.`
          : `Review complete (${a.overall_score}/100).`
      );
    } catch (err) {
      setMessage(err.response?.data?.error || err.message || 'Analysis failed');
    } finally {
      setAiBusy(false);
    }
  };

  const runScore = async () => {
    if (jobMode === 'list' && !selectedJobId) {
      setMessage('Select a job or paste a job description first.');
      return;
    }
    if (jobMode === 'paste' && !pastedJd.trim()) {
      setMessage('Paste a job description first.');
      return;
    }
    setAiBusy(true);
    try {
      const body = { ...draftPayload(), ...jobContextPayload() };
      const res = await api.post(`/resumes/${id}/score`, body);
      setFitResult(res.data);
      setActiveTab('fit');
      const list = res.data.suggestions?.length
        ? res.data.suggestions
        : await fetchSuggestions(jobContextPayload());
      if (res.data.suggestions?.length) {
        setSuggestions(res.data.suggestions);
        setActiveSuggestionIdx(0);
        setActiveTab('fixes');
      }
      setMessage(
        list.length
          ? `Match score ${res.data.score}/100. ${list.length} tailoring fixes ready.`
          : `Match score ${res.data.score}/100.`
      );
    } catch (err) {
      setMessage(err.response?.data?.error || err.message || 'Scoring failed');
    } finally {
      setAiBusy(false);
    }
  };

  const runSuggestionsOnly = async () => {
    setAiBusy(true);
    try {
      const list = await fetchSuggestions();
      setMessage(
        list.length
          ? `${list.length} suggestions — fields highlighted in editor. Click to focus.`
          : 'No suggestions returned. Add more resume content or check AI settings.'
      );
    } catch (err) {
      setMessage(err.response?.data?.error || err.message || 'Suggestions failed');
    } finally {
      setAiBusy(false);
    }
  };

  const suggestionHighlightKeys = useMemo(() => {
    const keys = new Set();
    for (const s of suggestions) {
      keys.add(suggestionToHighlightKey(s, structured));
    }
    return keys;
  }, [suggestions, structured]);

  const activeSuggestionKey = useMemo(() => {
    if (activeSuggestionIdx == null || !suggestions[activeSuggestionIdx]) return null;
    return suggestionToHighlightKey(suggestions[activeSuggestionIdx], structured);
  }, [activeSuggestionIdx, suggestions, structured]);

  const handleApplySuggestion = (idx) => {
    const s = suggestions[idx];
    if (!s?.proposed_text) {
      setActiveSuggestionIdx(idx);
      setMessage('No auto-apply text — use the suggestion as guidance and edit the highlighted field.');
      return;
    }
    const next = applySuggestionToStructured(structured, s);
    setStructured(next);
    setDirty(true);
    setActiveSuggestionIdx(idx);
    setMessage('Fix applied — review and save.');
  };

  const handleStructuredChange = (next) => {
    setStructured(next);
    setDirty(true);
  };

  const hasEditorContent = useMemo(() => {
    return Boolean(
      contentText?.trim() ||
      structured.summary?.trim() ||
      structured.experience?.length ||
      structured.skills?.length
    );
  }, [contentText, structured]);

  if (isLoading) {
    return <div className="loading">Loading Resume Studio…</div>;
  }

  if (!resume) {
    return <div className="error">Resume not found</div>;
  }

  const recommendationLabel = {
    apply: 'Strong fit — consider applying',
    tailor_first: 'Promising — tailor resume first',
    skip: 'Low fit — focus elsewhere',
  };

  return (
    <div className="resume-studio">
      <header className="studio-header">
        <div className="studio-header-left">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/resumes')}>
            <FiArrowLeft /> My Resumes
          </button>
          <div>
            <h1>Resume Studio</h1>
            <p className="studio-subtitle">
              Edit, analyze ATS readiness, and score against jobs — fixes highlight in the editor automatically.
            </p>
          </div>
        </div>
        <div className="studio-header-actions">
          {contentText && !(structured.experience?.length) && (
            <LoadingButton
              className="btn btn-secondary"
              loading={parseMutation.isLoading}
              loadingLabel="Parsing…"
              onClick={() => parseMutation.mutate()}
            >
              Parse into sections
            </LoadingButton>
          )}
          <LoadingButton
            className="btn btn-primary"
            icon={FiSave}
            loading={saveMutation.isLoading}
            loadingLabel="Saving…"
            onClick={() => saveMutation.mutate()}
            disabled={!dirty && !saveMutation.isLoading}
          >
            {dirty ? 'Save changes' : 'Saved'}
          </LoadingButton>
        </div>
      </header>

      {!hasEditorContent && (
        <div className="studio-message studio-message-warn">
          Add resume content in the editor (or parse imported text) before running AI.
        </div>
      )}

      {message && (
        <div className="studio-message" role="status">
          {message}
          <button type="button" className="studio-message-dismiss" onClick={() => setMessage('')}>
            ×
          </button>
        </div>
      )}

      <div className="studio-layout">
        <div className="studio-editor-pane">
          <div className="studio-pane-title">
            <FiEdit3 /> Editor
            {suggestions.length > 0 && (
              <span className="badge badge-warning">{suggestions.length} fixes to review</span>
            )}
          </div>
          <ResumeEditor
            structured={structured}
            onChange={handleStructuredChange}
            activeSuggestionKeys={suggestionHighlightKeys}
            activeSuggestionKey={activeSuggestionKey}
            fileName={fileName}
            onFileNameChange={(v) => {
              setFileName(v);
              setDirty(true);
            }}
          />
          {contentText && (
            <details className="raw-text-details">
              <summary>Imported raw text</summary>
              <textarea rows={6} value={contentText} readOnly />
            </details>
          )}
        </div>

        <aside className="studio-insights-pane">
          <div className="studio-tabs">
            {[
              { id: 'fit', label: 'Job fit', icon: FiTarget },
              { id: 'analysis', label: 'AI review', icon: FiZap },
              { id: 'fixes', label: `Fixes${suggestions.length ? ` (${suggestions.length})` : ''}`, icon: FiEdit3 },
            ].map(({ id: tabId, label, icon: Icon }) => (
              <button
                key={tabId}
                type="button"
                className={`studio-tab ${activeTab === tabId ? 'active' : ''}`}
                onClick={() => setActiveTab(tabId)}
              >
                <Icon /> {label}
              </button>
            ))}
          </div>

          {activeTab === 'fit' && (
            <div className="studio-panel">
              <p className="panel-intro">
                Check fit before you apply — scoring also loads tailoring fixes in the editor.
              </p>
              <div className="job-mode-toggle">
                <button type="button" className={jobMode === 'list' ? 'active' : ''} onClick={() => setJobMode('list')}>
                  From job list
                </button>
                <button type="button" className={jobMode === 'paste' ? 'active' : ''} onClick={() => setJobMode('paste')}>
                  Paste JD
                </button>
              </div>
              {jobMode === 'list' ? (
                <select value={selectedJobId} onChange={(e) => setSelectedJobId(e.target.value)}>
                  <option value="">Select a job…</option>
                  {(jobs || []).map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title} — {job.company}
                    </option>
                  ))}
                </select>
              ) : (
                <textarea
                  rows={8}
                  placeholder="Paste the full job description here…"
                  value={pastedJd}
                  onChange={(e) => setPastedJd(e.target.value)}
                />
              )}
              <LoadingButton
                className="btn btn-primary btn-block"
                icon={FiTarget}
                loading={aiBusy}
                loadingLabel="Scoring…"
                onClick={runScore}
                disabled={!hasEditorContent}
              >
                Score &amp; get fixes
              </LoadingButton>

              {fitResult && (
                <div className="fit-results">
                  <ScoreRing score={fitResult.score} label="Match score" />
                  <p className={`fit-recommendation fit-${fitResult.recommendation}`}>
                    {recommendationLabel[fitResult.recommendation] || fitResult.summary}
                  </p>
                  {fitResult.summary && <p className="fit-summary">{fitResult.summary}</p>}
                  {fitResult.matched_keywords?.length > 0 && (
                    <div className="keyword-block">
                      <h4>Matched keywords</h4>
                      <div className="keyword-tags">
                        {fitResult.matched_keywords.map((k) => (
                          <span key={k} className="keyword-tag keyword-good">{k}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {fitResult.missing_keywords?.length > 0 && (
                    <div className="keyword-block">
                      <h4>Gaps to address</h4>
                      <div className="keyword-tags">
                        {fitResult.missing_keywords.map((k) => (
                          <span key={k} className="keyword-tag keyword-missing">{k}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {fitResult.tailoring_tips?.length > 0 && (
                    <ul className="tips-list">
                      {fitResult.tailoring_tips.map((tip, i) => (
                        <li key={i}>{tip}</li>
                      ))}
                    </ul>
                  )}
                  {selectedJobId && (
                    <Link to={`/jobs/${selectedJobId}`} className="btn btn-secondary btn-sm">
                      View job details →
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'analysis' && (
            <div className="studio-panel">
              <p className="panel-intro">ATS review — also loads fix suggestions into the editor.</p>
              <LoadingButton
                className="btn btn-primary btn-block"
                icon={FiZap}
                loading={aiBusy}
                loadingLabel="Analyzing…"
                onClick={runAnalyze}
                disabled={!hasEditorContent}
              >
                Analyze &amp; get fixes
              </LoadingButton>
              {analysis && (
                <div className="analysis-results">
                  <div className="score-row">
                    <ScoreRing score={analysis.overall_score} label="Overall" />
                    <ScoreRing score={analysis.ats_score} label="ATS" />
                  </div>
                  {analysis.summary && <p className="fit-summary">{analysis.summary}</p>}
                  {analysis.strengths?.length > 0 && (
                    <div className="insight-block insight-good">
                      <h4><FiCheckCircle /> Strengths</h4>
                      <ul>{analysis.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
                    </div>
                  )}
                  {analysis.gaps?.length > 0 && (
                    <div className="insight-block insight-warn">
                      <h4><FiAlertCircle /> Gaps</h4>
                      <ul>{analysis.gaps.map((s, i) => <li key={i}>{s}</li>)}</ul>
                    </div>
                  )}
                  {analysis.ats_tips?.length > 0 && (
                    <div className="insight-block">
                      <h4>ATS tips</h4>
                      <ul>{analysis.ats_tips.map((s, i) => <li key={i}>{s}</li>)}</ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'fixes' && (
            <div className="studio-panel">
              <p className="panel-intro">
                Highlighted fields need attention — click a fix to focus, Apply to insert AI rewrite.
              </p>
              <LoadingButton
                className="btn btn-primary btn-block"
                icon={FiEdit3}
                loading={aiBusy}
                loadingLabel="Loading…"
                onClick={runSuggestionsOnly}
                disabled={!hasEditorContent}
              >
                Refresh fix suggestions
              </LoadingButton>
              <ul className="suggestions-list">
                {suggestions.map((s, idx) => (
                  <li
                    key={s.id || idx}
                    className={`suggestion-item severity-${s.severity} ${activeSuggestionIdx === idx ? 'active' : ''}`}
                  >
                    <button
                      type="button"
                      className="suggestion-focus-btn"
                      onClick={() => setActiveSuggestionIdx(idx)}
                    >
                      <span className="suggestion-section">{s.section}</span>
                      <strong>{s.issue}</strong>
                      <p>{s.suggestion}</p>
                    </button>
                    {s.proposed_text && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm suggestion-apply-btn"
                        onClick={() => handleApplySuggestion(idx)}
                      >
                        Apply fix
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {suggestions.length === 0 && (
                <p className="panel-intro">Run Analyze or Score to generate contextual fixes.</p>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default ResumeStudio;
