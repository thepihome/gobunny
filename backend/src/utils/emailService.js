import { query } from './db.js';
import { getEmailConfig, getSmtpPassword } from './emailSettingsDb.js';
import { sendSmtpMail } from './smtpClient.js';
import { EMAIL_ACTION_IDS, defaultEmailConfig } from './emailConstants.js';

/** Replace {{variable}} placeholders in a template string. */
export function renderTemplate(template, variables = {}) {
  if (!template) return '';
  return String(template).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const val = variables[key];
    return val === undefined || val === null ? '' : String(val);
  });
}

export function scheduleTask(ctx, task) {
  const run = async () => {
    try {
      await task();
    } catch (e) {
      console.error('Background email task failed:', e);
    }
  };
  if (ctx && typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(run());
  } else {
    run();
  }
}

function isActionEnabled(config, actionId) {
  if (!config.enabled) return false;
  if (!EMAIL_ACTION_IDS.includes(actionId)) return false;
  return config.actions?.[actionId] !== false;
}

async function buildSmtpRuntime(env, config) {
  const password = await getSmtpPassword(env, env.JWT_SECRET);
  return {
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    username: config.smtp.username,
    password,
    from_email: config.smtp.from_email,
    from_name: config.smtp.from_name || config.app_name,
  };
}

/**
 * Send a configured transactional email. Returns silently when disabled or misconfigured.
 */
export async function sendTransactionalEmail(env, actionId, recipient, variables = {}) {
  const config = await getEmailConfig(env);
  if (!isActionEnabled(config, actionId)) {
    return { skipped: true, reason: 'disabled' };
  }

  const to = String(recipient || '').trim();
  if (!to) return { skipped: true, reason: 'no_recipient' };

  if (!config.smtp?.host || !config.smtp?.from_email) {
    console.warn(`Email action ${actionId} skipped: SMTP not configured`);
    return { skipped: true, reason: 'smtp_not_configured' };
  }

  const template = config.templates?.[actionId];
  if (!template?.subject) {
    console.warn(`Email action ${actionId} skipped: no template`);
    return { skipped: true, reason: 'no_template' };
  }

  const vars = {
    app_name: config.app_name || 'GoBunny',
    ...variables,
  };

  const subject = renderTemplate(template.subject, vars);
  const text = renderTemplate(template.body_text, vars);
  const html = renderTemplate(template.body_html, vars);

  const smtp = await buildSmtpRuntime(env, config);
  await sendSmtpMail(smtp, { to, subject, text, html });
  return { sent: true, to, actionId };
}

export function queueTransactionalEmail(ctx, env, actionId, recipient, variables) {
  scheduleTask(ctx, () => sendTransactionalEmail(env, actionId, recipient, variables));
}

export async function sendTestEmail(env, recipient) {
  const config = await getEmailConfig(env);
  const to = String(recipient || '').trim();
  if (!to) return { skipped: true, reason: 'no_recipient' };
  if (!config.smtp?.host || !config.smtp?.from_email) {
    return { skipped: true, reason: 'smtp_not_configured' };
  }

  const template = config.templates?.user_signup || defaultEmailConfig().templates.user_signup;
  const vars = {
    app_name: config.app_name || 'GoBunny',
    first_name: 'Test',
    last_name: 'User',
    email: to,
  };
  const subject = renderTemplate(template.subject, vars);
  const text = renderTemplate(template.body_text, vars);
  const html = renderTemplate(template.body_html, vars);
  const smtp = await buildSmtpRuntime(env, config);
  await sendSmtpMail(smtp, { to, subject, text, html });
  return { sent: true, to };
}

export async function getActiveAdminEmails(env) {
  const rows = await query(
    env,
    `SELECT email FROM users WHERE role = 'admin' AND is_active = 1 AND email IS NOT NULL AND TRIM(email) != ''`
  );
  return (rows || []).map((r) => r.email.trim()).filter(Boolean);
}

export async function notifyAdmins(ctx, env, actionId, variables) {
  const emails = await getActiveAdminEmails(env);
  for (const email of emails) {
    queueTransactionalEmail(ctx, env, actionId, email, variables);
  }
}
