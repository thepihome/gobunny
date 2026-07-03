import { getAppSetting, setAppSetting } from './appSettingsDb.js';
import { encryptSecret, decryptSecret } from './crypto.js';
import {
  EMAIL_ACTION_IDS,
  defaultEmailConfig,
  DEFAULT_EMAIL_TEMPLATES,
} from './emailConstants.js';

const EMAIL_CONFIG_KEY = 'email_config';

export async function getEmailConfig(env) {
  const raw = await getAppSetting(env, EMAIL_CONFIG_KEY);
  const base = defaultEmailConfig();
  if (!raw) return base;
  try {
    const parsed = JSON.parse(raw);
    return mergeEmailConfig(base, parsed);
  } catch {
    return base;
  }
}

function mergeEmailConfig(base, partial) {
  const next = {
    ...base,
    ...partial,
    smtp: { ...base.smtp, ...(partial.smtp || {}) },
    actions: { ...base.actions, ...(partial.actions || {}) },
    templates: { ...base.templates },
  };
  for (const id of EMAIL_ACTION_IDS) {
    next.templates[id] = {
      ...base.templates[id],
      ...(partial.templates?.[id] || {}),
    };
  }
  return next;
}

export async function saveEmailConfig(env, partial, jwtSecret) {
  const current = await getEmailConfig(env);
  const next = mergeEmailConfig(current, partial);

  if (partial.smtp) {
    const incomingPassword = partial.smtp.password;
    if (typeof incomingPassword === 'string' && incomingPassword.trim() !== '') {
      next.smtp.password = await encryptSecret(incomingPassword.trim(), jwtSecret);
    } else {
      next.smtp.password = current.smtp.password || '';
    }
    delete next.smtp.password_enc;
  }

  await setAppSetting(env, EMAIL_CONFIG_KEY, JSON.stringify(next));
  return next;
}

export async function getSmtpPassword(env, jwtSecret) {
  const config = await getEmailConfig(env);
  return decryptSecret(config.smtp.password, jwtSecret);
}

export function maskSecret(value) {
  if (!value || typeof value !== 'string') return '';
  if (value.length <= 4) return '****';
  return `${value.slice(0, 2)}…${value.slice(-2)}`;
}

export function toPublicEmailConfig(config) {
  const passwordSet = !!(config.smtp?.password && config.smtp.password.length > 0);
  return {
    enabled: !!config.enabled,
    app_name: config.app_name || 'GoBunny',
    smtp: {
      host: config.smtp?.host || '',
      port: config.smtp?.port ?? 587,
      secure: config.smtp?.secure || 'starttls',
      username: config.smtp?.username || '',
      password_set: passwordSet,
      password_preview: passwordSet ? maskSecret('xxxxxxxx') : '',
      from_name: config.smtp?.from_name || '',
      from_email: config.smtp?.from_email || '',
    },
    actions: { ...config.actions },
    templates: { ...config.templates },
    action_catalog: EMAIL_ACTION_IDS,
  };
}

export function resetTemplateToDefault(actionId) {
  const defaults = DEFAULT_EMAIL_TEMPLATES[actionId];
  if (!defaults) return null;
  return { ...defaults };
}
