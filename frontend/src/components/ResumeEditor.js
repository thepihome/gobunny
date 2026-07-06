import React, { useRef, useEffect } from 'react';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import { newEducationId, newExperienceId } from '../utils/resumeExtract';

function fieldHighlightClass(activeKeys, key, isActive) {
  if (!activeKeys?.has(key)) return '';
  return isActive ? 'editor-field-highlight editor-field-highlight-active' : 'editor-field-highlight';
}

const ResumeEditor = ({
  structured,
  onChange,
  activeSuggestionKeys,
  activeSuggestionKey,
  fileName,
  onFileNameChange,
}) => {
  const highlightRef = useRef(null);

  useEffect(() => {
    if (activeSuggestionKey && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeSuggestionKey]);

  const s = structured || {
    contact: {},
    summary: '',
    experience: [],
    education: [],
    skills: [],
  };

  const update = (patch) => onChange({ ...s, ...patch });

  const updateContact = (field, value) => {
    update({ contact: { ...s.contact, [field]: value } });
  };

  const updateExperience = (idx, patch) => {
    const experience = [...(s.experience || [])];
    experience[idx] = { ...experience[idx], ...patch };
    update({ experience });
  };

  const updateBullet = (expIdx, bulletIdx, value) => {
    const experience = [...(s.experience || [])];
    const bullets = [...(experience[expIdx].bullets || [])];
    bullets[bulletIdx] = value;
    experience[expIdx] = { ...experience[expIdx], bullets };
    update({ experience });
  };

  const addExperience = () => {
    update({
      experience: [
        ...(s.experience || []),
        { id: newExperienceId(), title: '', company: '', dates: '', bullets: [''] },
      ],
    });
  };

  const removeExperience = (idx) => {
    update({ experience: (s.experience || []).filter((_, i) => i !== idx) });
  };

  const addBullet = (expIdx) => {
    const experience = [...(s.experience || [])];
    experience[expIdx] = {
      ...experience[expIdx],
      bullets: [...(experience[expIdx].bullets || []), ''],
    };
    update({ experience });
  };

  const updateEducation = (idx, patch) => {
    const education = [...(s.education || [])];
    education[idx] = { ...education[idx], ...patch };
    update({ education });
  };

  const addEducation = () => {
    update({
      education: [...(s.education || []), { id: newEducationId(), degree: '', school: '', dates: '' }],
    });
  };

  const skillsText = (s.skills || []).join(', ');

  const hl = (key) =>
    fieldHighlightClass(activeSuggestionKeys, key, activeSuggestionKey === key);

  return (
    <div className="resume-editor">
      <div className="form-group">
        <label>Resume title</label>
        <input
          type="text"
          value={fileName || ''}
          onChange={(e) => onFileNameChange(e.target.value)}
          placeholder="Software Engineer Resume"
        />
      </div>

      <section className="editor-section">
        <h3>Contact</h3>
        <div className="editor-grid">
          <input
            className={hl('contact.name')}
            placeholder="Full name"
            value={s.contact?.name || ''}
            onChange={(e) => updateContact('name', e.target.value)}
          />
          <input
            className={hl('contact.email')}
            placeholder="Email"
            value={s.contact?.email || ''}
            onChange={(e) => updateContact('email', e.target.value)}
          />
          <input
            className={hl('contact.phone')}
            placeholder="Phone"
            value={s.contact?.phone || ''}
            onChange={(e) => updateContact('phone', e.target.value)}
          />
          <input
            className={hl('contact.linkedin')}
            placeholder="LinkedIn URL"
            value={s.contact?.linkedin || ''}
            onChange={(e) => updateContact('linkedin', e.target.value)}
          />
        </div>
      </section>

      <section className="editor-section">
        <h3>Professional summary</h3>
        <textarea
          ref={activeSuggestionKey === 'summary' ? highlightRef : null}
          className={hl('summary')}
          rows={4}
          value={s.summary || ''}
          onChange={(e) => update({ summary: e.target.value })}
          placeholder="2–3 sentences highlighting your impact and focus areas"
        />
      </section>

      <section className="editor-section">
        <div className="editor-section-head">
          <h3>Experience</h3>
          <button type="button" className="btn btn-secondary btn-sm" onClick={addExperience}>
            <FiPlus /> Add role
          </button>
        </div>
        {(s.experience || []).map((exp, idx) => {
          const expKey = `experience.${exp.id}`;
          const isExpActive = activeSuggestionKey === expKey || activeSuggestionKey?.startsWith(`${expKey}.`);
          return (
            <div
              key={exp.id || idx}
              ref={isExpActive && !activeSuggestionKey?.includes('.bullet.') ? highlightRef : null}
              className={`experience-block ${hl(expKey)}`}
            >
              <div className="editor-grid">
                <input
                  placeholder="Job title"
                  value={exp.title || ''}
                  onChange={(e) => updateExperience(idx, { title: e.target.value })}
                />
                <input
                  placeholder="Company"
                  value={exp.company || ''}
                  onChange={(e) => updateExperience(idx, { company: e.target.value })}
                />
                <input
                  placeholder="Dates (e.g. 2020 – 2024)"
                  value={exp.dates || ''}
                  onChange={(e) => updateExperience(idx, { dates: e.target.value })}
                />
              </div>
              {(exp.bullets || []).map((bullet, bIdx) => {
                const bulletKey = `${expKey}.bullet.${bIdx}`;
                return (
                  <textarea
                    key={bIdx}
                    ref={activeSuggestionKey === bulletKey ? highlightRef : null}
                    className={hl(bulletKey)}
                    rows={2}
                    value={bullet}
                    onChange={(e) => updateBullet(idx, bIdx, e.target.value)}
                    placeholder="Achievement with metrics (e.g. Reduced latency 40%…)"
                  />
                );
              })}
              <div className="experience-actions">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => addBullet(idx)}>
                  + Bullet
                </button>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => removeExperience(idx)}>
                  <FiTrash2 /> Remove
                </button>
              </div>
            </div>
          );
        })}
      </section>

      <section className="editor-section">
        <div className="editor-section-head">
          <h3>Education</h3>
          <button type="button" className="btn btn-secondary btn-sm" onClick={addEducation}>
            <FiPlus /> Add
          </button>
        </div>
        {(s.education || []).map((edu, idx) => {
          const eduKey = `education.${edu.id}`;
          return (
            <div
              key={edu.id || idx}
              ref={activeSuggestionKey === eduKey ? highlightRef : null}
              className={`editor-grid education-row ${hl(eduKey)}`}
            >
              <input
                placeholder="Degree"
                value={edu.degree || ''}
                onChange={(e) => updateEducation(idx, { degree: e.target.value })}
              />
              <input
                placeholder="School"
                value={edu.school || ''}
                onChange={(e) => updateEducation(idx, { school: e.target.value })}
              />
              <input
                placeholder="Dates"
                value={edu.dates || ''}
                onChange={(e) => updateEducation(idx, { dates: e.target.value })}
              />
            </div>
          );
        })}
      </section>

      <section className="editor-section">
        <h3>Skills</h3>
        <input
          ref={activeSuggestionKey === 'skills' ? highlightRef : null}
          className={hl('skills')}
          type="text"
          value={skillsText}
          onChange={(e) =>
            update({
              skills: e.target.value.split(',').map((x) => x.trim()).filter(Boolean),
            })
          }
          placeholder="JavaScript, React, Node.js, AWS"
        />
      </section>
    </div>
  );
};

export default ResumeEditor;

export function suggestionToHighlightKey(s, structured) {
  if (!s) return '';
  if (s.section === 'summary') return 'summary';
  if (s.section === 'skills') return 'skills';
  if (s.section === 'contact') return `contact.${s.field || 'name'}`;

  if (s.section === 'experience') {
    let expId = s.item_id;
    if (!expId && s.exp_index != null && structured?.experience?.[s.exp_index]) {
      expId = structured.experience[s.exp_index].id;
    }
    if (!expId && structured?.experience?.length === 1) {
      expId = structured.experience[0].id;
    }
    if (expId) {
      if (s.bullet_index != null && s.bullet_index >= 0) {
        return `experience.${expId}.bullet.${s.bullet_index}`;
      }
      return `experience.${expId}`;
    }
    return 'experience';
  }

  if (s.section === 'education') {
    let eduId = s.item_id;
    if (!eduId && structured?.education?.length === 1) {
      eduId = structured.education[0].id;
    }
    if (eduId) return `education.${eduId}`;
    return 'education';
  }

  return s.field || s.section || '';
}

export function applySuggestionToStructured(structured, suggestion) {
  if (!suggestion?.proposed_text) return structured;
  const next = JSON.parse(JSON.stringify(structured));
  const text = suggestion.proposed_text;

  if (suggestion.section === 'summary') {
    next.summary = text;
    return next;
  }
  if (suggestion.section === 'skills') {
    next.skills = text.split(',').map((x) => x.trim()).filter(Boolean);
    return next;
  }
  if (suggestion.section === 'contact' && suggestion.field) {
    next.contact = { ...next.contact, [suggestion.field]: text };
    return next;
  }
  if (suggestion.section === 'experience') {
    let idx = next.experience?.findIndex((e) => e.id === suggestion.item_id);
    if (idx < 0 && suggestion.exp_index != null) idx = suggestion.exp_index;
    if (idx < 0 && next.experience?.length === 1) idx = 0;
    if (idx >= 0 && next.experience[idx]) {
      if (suggestion.bullet_index != null && suggestion.bullet_index >= 0) {
        const bullets = [...(next.experience[idx].bullets || [])];
        bullets[suggestion.bullet_index] = text;
        next.experience[idx].bullets = bullets;
      } else if (suggestion.field === 'title') {
        next.experience[idx].title = text;
      } else if (suggestion.field === 'company') {
        next.experience[idx].company = text;
      }
    }
    return next;
  }
  return next;
}
