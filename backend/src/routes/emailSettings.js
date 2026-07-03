/**
 * Admin-only email / SMTP configuration (stored in app_settings).
 * Exposed at /api/permissions/email
 */

import { addCorsHeaders } from '../utils/cors.js';
import { authorize } from '../middleware/auth.js';
import {
  getEmailConfig,
  saveEmailConfig,
  toPublicEmailConfig,
  resetTemplateToDefault,
} from '../utils/emailSettingsDb.js';
import { EMAIL_ACTIONS } from '../utils/emailConstants.js';
import { sendTestEmail } from '../utils/emailService.js';

export async function handleEmailSettingsAdmin(request, env, user) {
  const method = request.method;
  const url = new URL(request.url);
  const pathNorm = (url.pathname || '/').replace(/\/+$/, '') || '/';

  const authError = authorize('admin')(user);
  if (authError) {
    return addCorsHeaders(
      new Response(JSON.stringify({ error: authError.error }), {
        status: authError.status || 403,
        headers: { 'Content-Type': 'application/json' },
      }),
      env,
      request
    );
  }

  if (pathNorm === '/api/permissions/email' && method === 'GET') {
    const config = await getEmailConfig(env);
    const pub = toPublicEmailConfig(config);
    pub.action_catalog = EMAIL_ACTIONS;
    return addCorsHeaders(
      new Response(JSON.stringify(pub), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
      env,
      request
    );
  }

  if (pathNorm === '/api/permissions/email' && method === 'PUT') {
    try {
      const body = await request.json();
      const current = await getEmailConfig(env);
      const partial = {};

      if (typeof body.enabled === 'boolean') partial.enabled = body.enabled;
      if (typeof body.app_name === 'string') partial.app_name = body.app_name.trim();

      if (body.smtp && typeof body.smtp === 'object') {
        partial.smtp = {};
        const s = body.smtp;
        if (typeof s.host === 'string') partial.smtp.host = s.host.trim();
        if (s.port !== undefined) {
          const port = parseInt(String(s.port), 10);
          if (!Number.isNaN(port) && port > 0 && port < 65536) partial.smtp.port = port;
        }
        if (typeof s.secure === 'string' && ['off', 'starttls', 'ssl'].includes(s.secure)) {
          partial.smtp.secure = s.secure;
        }
        if (typeof s.username === 'string') partial.smtp.username = s.username.trim();
        if (typeof s.password === 'string' && s.password.trim() !== '') {
          partial.smtp.password = s.password.trim();
        }
        if (typeof s.from_name === 'string') partial.smtp.from_name = s.from_name.trim();
        if (typeof s.from_email === 'string') partial.smtp.from_email = s.from_email.trim();
      }

      if (body.actions && typeof body.actions === 'object') {
        partial.actions = { ...current.actions };
        for (const action of EMAIL_ACTIONS) {
          if (typeof body.actions[action.id] === 'boolean') {
            partial.actions[action.id] = body.actions[action.id];
          }
        }
      }

      if (body.templates && typeof body.templates === 'object') {
        partial.templates = { ...current.templates };
        for (const action of EMAIL_ACTIONS) {
          const incoming = body.templates[action.id];
          if (!incoming || typeof incoming !== 'object') continue;
          partial.templates[action.id] = { ...partial.templates[action.id] };
          if (typeof incoming.subject === 'string') {
            partial.templates[action.id].subject = incoming.subject;
          }
          if (typeof incoming.body_text === 'string') {
            partial.templates[action.id].body_text = incoming.body_text;
          }
          if (typeof incoming.body_html === 'string') {
            partial.templates[action.id].body_html = incoming.body_html;
          }
        }
      }

      await saveEmailConfig(env, partial, env.JWT_SECRET);
      const saved = await getEmailConfig(env);
      const pub = toPublicEmailConfig(saved);
      pub.action_catalog = EMAIL_ACTIONS;
      return addCorsHeaders(
        new Response(JSON.stringify(pub), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
        env,
        request
      );
    } catch (e) {
      console.error('PUT email settings:', e);
      return addCorsHeaders(
        new Response(JSON.stringify({ error: 'Server error', details: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
        env,
        request
      );
    }
  }

  const resetMatch = pathNorm.match(/^\/api\/permissions\/email\/templates\/([a-z_]+)\/reset$/);
  if (resetMatch && method === 'POST') {
    const actionId = resetMatch[1];
    const defaults = resetTemplateToDefault(actionId);
    if (!defaults) {
      return addCorsHeaders(
        new Response(JSON.stringify({ error: 'Unknown template action' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }),
        env,
        request
      );
    }
    const current = await getEmailConfig(env);
    await saveEmailConfig(
      env,
      { templates: { ...current.templates, [actionId]: defaults } },
      env.JWT_SECRET
    );
    const saved = await getEmailConfig(env);
    return addCorsHeaders(
      new Response(JSON.stringify({ template: saved.templates[actionId] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
      env,
      request
    );
  }

  if (pathNorm === '/api/permissions/email/test' && method === 'POST') {
    try {
      const body = await request.json();
      const to = String(body.to || user.email || '').trim();
      if (!to) {
        return addCorsHeaders(
          new Response(JSON.stringify({ error: 'Recipient email is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }),
          env,
          request
        );
      }
      const result = await sendTestEmail(env, to);
      if (result.skipped) {
        return addCorsHeaders(
          new Response(JSON.stringify({ error: `Email not sent: ${result.reason}` }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }),
          env,
          request
        );
      }
      return addCorsHeaders(
        new Response(JSON.stringify({ ok: true, message: `Test email sent to ${to}` }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
        env,
        request
      );
    } catch (e) {
      console.error('POST email test:', e);
      return addCorsHeaders(
        new Response(JSON.stringify({ error: 'Failed to send test email', details: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
        env,
        request
      );
    }
  }

  return addCorsHeaders(
    new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    }),
    env,
    request
  );
}
