/** Catalog of configurable transactional email actions. */

export const EMAIL_ACTIONS = [
  {
    id: 'user_signup',
    label: 'New user signup',
    description: 'Sent when someone self-registers as a candidate.',
    variables: ['first_name', 'last_name', 'email', 'app_name'],
  },
  {
    id: 'user_created',
    label: 'User account created',
    description: 'Sent when an admin creates a consultant or admin account.',
    variables: ['first_name', 'last_name', 'email', 'role', 'app_name'],
  },
  {
    id: 'candidate_onboarded',
    label: 'Candidate onboarded',
    description: 'Sent when an admin adds a new candidate to the platform.',
    variables: ['first_name', 'last_name', 'email', 'app_name'],
  },
  {
    id: 'job_match_found',
    label: 'Job match found',
    description: 'Sent to a candidate when a new AI job match is stored above the minimum score.',
    variables: ['first_name', 'last_name', 'email', 'job_title', 'job_company', 'match_score', 'app_name'],
  },
  {
    id: 'timesheet_submitted',
    label: 'Timesheet submitted',
    description: 'Sent to all active admins when a consultant submits a timesheet.',
    variables: ['consultant_name', 'candidate_name', 'job_title', 'period_start', 'period_end', 'app_name'],
  },
  {
    id: 'timesheet_approved',
    label: 'Timesheet approved',
    description: 'Sent to the consultant when their timesheet is approved.',
    variables: ['consultant_name', 'candidate_name', 'job_title', 'period_start', 'period_end', 'app_name'],
  },
  {
    id: 'timesheet_rejected',
    label: 'Timesheet rejected',
    description: 'Sent to the consultant when their timesheet is rejected.',
    variables: ['consultant_name', 'candidate_name', 'job_title', 'period_start', 'period_end', 'app_name'],
  },
];

export const EMAIL_ACTION_IDS = EMAIL_ACTIONS.map((a) => a.id);

const DEFAULT_APP_NAME = 'GoBunny';

function tpl(subject, text, html) {
  return { subject, body_text: text, body_html: html };
}

export const DEFAULT_EMAIL_TEMPLATES = {
  user_signup: tpl(
    'Welcome to {{app_name}}',
    `Hi {{first_name}},\n\nThanks for signing up with {{app_name}}. Your account ({{email}}) is ready.\n\n— The {{app_name}} team`,
    `<p>Hi {{first_name}},</p><p>Thanks for signing up with <strong>{{app_name}}</strong>. Your account (<code>{{email}}</code>) is ready.</p><p>— The {{app_name}} team</p>`
  ),
  user_created: tpl(
    'Your {{app_name}} account is ready',
    `Hi {{first_name}},\n\nAn administrator created your {{app_name}} account as a {{role}}.\n\nSign in with: {{email}}\n\n— The {{app_name}} team`,
    `<p>Hi {{first_name}},</p><p>An administrator created your <strong>{{app_name}}</strong> account as a <strong>{{role}}</strong>.</p><p>Sign in with: <code>{{email}}</code></p><p>— The {{app_name}} team</p>`
  ),
  candidate_onboarded: tpl(
    'Welcome to {{app_name}} — your candidate profile is ready',
    `Hi {{first_name}},\n\nYou've been onboarded to {{app_name}} as a candidate. Sign in with {{email}} to complete your profile and explore matched roles.\n\n— The {{app_name}} team`,
    `<p>Hi {{first_name}},</p><p>You've been onboarded to <strong>{{app_name}}</strong> as a candidate. Sign in with <code>{{email}}</code> to complete your profile and explore matched roles.</p><p>— The {{app_name}} team</p>`
  ),
  job_match_found: tpl(
    'New job match: {{job_title}}',
    `Hi {{first_name}},\n\nWe found a strong match for you: {{job_title}} at {{job_company}} (score: {{match_score}}).\n\nLog in to {{app_name}} to view details.\n\n— The {{app_name}} team`,
    `<p>Hi {{first_name}},</p><p>We found a strong match for you: <strong>{{job_title}}</strong> at {{job_company}} (score: {{match_score}}).</p><p>Log in to {{app_name}} to view details.</p><p>— The {{app_name}} team</p>`
  ),
  timesheet_submitted: tpl(
    'Timesheet submitted — {{consultant_name}}',
    `A timesheet was submitted by {{consultant_name}} for {{candidate_name}} ({{job_title}}), period {{period_start}} to {{period_end}}.\n\nReview it in {{app_name}}.`,
    `<p>A timesheet was submitted by <strong>{{consultant_name}}</strong> for {{candidate_name}} (<em>{{job_title}}</em>), period {{period_start}} to {{period_end}}.</p><p>Review it in {{app_name}}.</p>`
  ),
  timesheet_approved: tpl(
    'Timesheet approved — {{job_title}}',
    `Hi {{consultant_name}},\n\nYour timesheet for {{candidate_name}} ({{job_title}}), {{period_start}}–{{period_end}}, was approved.\n\n— {{app_name}}`,
    `<p>Hi {{consultant_name}},</p><p>Your timesheet for {{candidate_name}} (<em>{{job_title}}</em>), {{period_start}}–{{period_end}}, was <strong>approved</strong>.</p><p>— {{app_name}}</p>`
  ),
  timesheet_rejected: tpl(
    'Timesheet needs changes — {{job_title}}',
    `Hi {{consultant_name}},\n\nYour timesheet for {{candidate_name}} ({{job_title}}), {{period_start}}–{{period_end}}, was rejected. Please review and resubmit in {{app_name}}.`,
    `<p>Hi {{consultant_name}},</p><p>Your timesheet for {{candidate_name}} (<em>{{job_title}}</em>), {{period_start}}–{{period_end}}, was <strong>rejected</strong>. Please review and resubmit in {{app_name}}.</p>`
  ),
};

export const DEFAULT_EMAIL_ACTIONS = {
  user_signup: true,
  user_created: false,
  candidate_onboarded: true,
  job_match_found: false,
  timesheet_submitted: true,
  timesheet_approved: true,
  timesheet_rejected: true,
};

export const DEFAULT_SMTP_CONFIG = {
  host: '',
  port: 587,
  secure: 'starttls',
  username: '',
  password: '',
  from_name: DEFAULT_APP_NAME,
  from_email: '',
};

export function defaultEmailConfig() {
  return {
    enabled: false,
    app_name: DEFAULT_APP_NAME,
    smtp: { ...DEFAULT_SMTP_CONFIG },
    actions: { ...DEFAULT_EMAIL_ACTIONS },
    templates: JSON.parse(JSON.stringify(DEFAULT_EMAIL_TEMPLATES)),
  };
}
