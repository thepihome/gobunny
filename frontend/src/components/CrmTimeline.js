import React from 'react';
import {
  FiPhone,
  FiMail,
  FiCalendar,
  FiFileText,
  FiLinkedin,
  FiMessageSquare,
  FiVideo,
  FiBriefcase,
  FiCheckSquare,
  FiUser,
  FiClock,
  FiCheck,
  FiEdit2,
  FiTrash2,
} from 'react-icons/fi';
import { iconSpinClass } from './LoadingButton';

export const CRM_TYPE_CONFIG = {
  call: { label: 'Phone call', Icon: FiPhone },
  email: { label: 'Email', Icon: FiMail },
  meeting: { label: 'Meeting', Icon: FiCalendar },
  note: { label: 'Note', Icon: FiFileText },
  linkedin: { label: 'LinkedIn', Icon: FiLinkedin },
  sms: { label: 'SMS', Icon: FiMessageSquare },
  video_call: { label: 'Video call', Icon: FiVideo },
  interview: { label: 'Interview', Icon: FiBriefcase },
  task: { label: 'Task', Icon: FiCheckSquare },
};

export const CRM_STATUS_CONFIG = {
  open: { label: 'Open', className: 'crm-badge--open' },
  pending: { label: 'Pending', className: 'crm-badge--pending' },
  scheduled: { label: 'Scheduled', className: 'crm-badge--scheduled' },
  completed: { label: 'Completed', className: 'crm-badge--completed' },
  cancelled: { label: 'Cancelled', className: 'crm-badge--cancelled' },
};

export function crmStatusBadge(row) {
  const s = row.status;
  if (s && CRM_STATUS_CONFIG[s]) return CRM_STATUS_CONFIG[s];
  return { label: s ? String(s) : 'Unknown', className: 'crm-badge--unknown' };
}

export function crmDateKey(iso) {
  if (!iso) return '';
  return String(iso).slice(0, 10);
}

export function crmIsFollowUpOverdue(row) {
  if (!row.follow_up_date) return false;
  if (['completed', 'cancelled'].includes(row.status)) return false;
  const d = new Date(row.follow_up_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d < today;
}

const CrmTimeline = ({
  items = [],
  showCandidateName = true,
  showConsultant = false,
  showActions = false,
  onEdit,
  onComplete,
  onDelete,
  actionLoadingId = null,
  actionType = null,
}) => {
  if (!items.length) return null;

  return (
    <div className="crm-timeline">
      {items.map((row) => {
        const tc = CRM_TYPE_CONFIG[row.interaction_type] || CRM_TYPE_CONFIG.note;
        const TypeIcon = tc.Icon;
        const sc = crmStatusBadge(row);
        const overdue = crmIsFollowUpOverdue(row);
        const loading = actionLoadingId === row.id;

        return (
          <div key={row.id} className={`crm-timeline-item${overdue ? ' crm-timeline-item--overdue' : ''}`}>
            <div className="crm-timeline-marker">
              <TypeIcon aria-hidden />
            </div>
            <div className="crm-timeline-body glass-surface">
              <div className="crm-timeline-head">
                <strong>{tc.label}</strong>
                <span className={`crm-badge ${sc.className}`}>{sc.label}</span>
              </div>
              <time className="crm-timeline-date" dateTime={crmDateKey(row.interaction_date)}>
                {new Date(row.interaction_date).toLocaleString()}
              </time>
              {(showCandidateName || showConsultant) && (
                <p className="crm-timeline-who">
                  {showCandidateName && (
                    <>
                      <FiUser aria-hidden className="crm-timeline-who-icon" />
                      {row.candidate_first_name} {row.candidate_last_name}
                    </>
                  )}
                  {showConsultant && row.consultant_first_name && (
                    <span className="crm-timeline-owner">
                      {showCandidateName ? ' · ' : ''}
                      Logged by {row.consultant_first_name} {row.consultant_last_name}
                    </span>
                  )}
                </p>
              )}
              {row.notes && <p className="crm-timeline-notes">{row.notes}</p>}
              {row.follow_up_date && (
                <p className={`crm-follow-tag crm-timeline-follow${overdue ? ' crm-follow-tag--late' : ''}`}>
                  <FiClock aria-hidden />
                  Follow-up: {new Date(row.follow_up_date).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                  {overdue && ' · Overdue'}
                </p>
              )}
              {showActions && (
                <div className="crm-timeline-actions">
                  {row.status !== 'completed' && row.status !== 'cancelled' && onComplete && (
                    <button
                      type="button"
                      className="btn btn-success crm-timeline-btn"
                      onClick={() => onComplete(row)}
                      disabled={loading && actionType === 'complete'}
                    >
                      <FiCheck className={iconSpinClass(loading && actionType === 'complete')} />
                      Complete
                    </button>
                  )}
                  {onEdit && (
                    <button
                      type="button"
                      className="btn btn-secondary crm-timeline-btn"
                      onClick={() => onEdit(row)}
                      disabled={loading && actionType === 'edit'}
                    >
                      <FiEdit2 />
                      Edit
                    </button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      className="btn btn-danger crm-timeline-btn"
                      onClick={() => onDelete(row)}
                      disabled={loading && actionType === 'delete'}
                    >
                      <FiTrash2 className={iconSpinClass(loading && actionType === 'delete')} />
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CrmTimeline;
