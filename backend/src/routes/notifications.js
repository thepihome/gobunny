/**
 * Aggregated in-app notifications for the navbar bell.
 * GET  /api/notifications
 * POST /api/notifications/seen  — mark current notifications as seen (badge resets)
 * POST /api/notifications/clear — dismiss all current notifications from the list
 */

import { query, queryOne, execute } from '../utils/db.js';
import { addCorsHeaders } from '../utils/cors.js';

function json(env, request, data, status = 200) {
  return addCorsHeaders(
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
    env,
    request
  );
}

function sortItems(items) {
  return items
    .filter((x) => x && x.sortAt)
    .sort((a, b) => String(b.sortAt).localeCompare(String(a.sortAt)))
    .slice(0, 60);
}

async function getLastSeenAt(env, userId) {
  try {
    const row = await queryOne(
      env,
      'SELECT last_seen_at FROM user_notification_state WHERE user_id = ?',
      [userId]
    );
    return row?.last_seen_at || null;
  } catch (e) {
    console.warn('getLastSeenAt:', e.message);
    return null;
  }
}

async function getDismissedIds(env, userId) {
  try {
    const rows = await query(
      env,
      'SELECT notification_id FROM notification_dismissals WHERE user_id = ?',
      [userId]
    );
    return new Set((rows || []).map((row) => row.notification_id));
  } catch (e) {
    console.warn('getDismissedIds:', e.message);
    return new Set();
  }
}

function isUnread(notification, lastSeenAt) {
  if (!lastSeenAt) return true;
  return String(notification.sortAt) > String(lastSeenAt);
}

function countUnread(notifications, lastSeenAt) {
  return notifications.filter((n) => isUnread(n, lastSeenAt)).length;
}

async function markNotificationsSeen(env, userId) {
  await execute(
    env,
    `INSERT INTO user_notification_state (user_id, last_seen_at)
     VALUES (?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET last_seen_at = datetime('now')`,
    [userId]
  );
}

async function dismissNotificationIds(env, userId, ids) {
  for (const notificationId of ids) {
    await execute(
      env,
      `INSERT OR IGNORE INTO notification_dismissals (user_id, notification_id, dismissed_at)
       VALUES (?, ?, datetime('now'))`,
      [userId, notificationId]
    );
  }
}

async function collectNotifications(env, user) {
  const items = [];
  const role = user.role;
  const uid = user.id;

    /* --- New jobs (active, recently posted) --- */
    if (role === 'admin' || role === 'consultant' || role === 'candidate') {
      const jobLimit = role === 'candidate' ? 8 : 12;
      const jobs = await query(
        env,
        `SELECT id, title, company, created_at
         FROM jobs
         WHERE status = 'active'
           AND datetime(created_at) > datetime('now', '-14 days')
         ORDER BY datetime(created_at) DESC
         LIMIT ?`,
        [jobLimit]
      );
      for (const j of jobs || []) {
        items.push({
          id: `job-new-${j.id}`,
          type: 'new_job',
          title: 'New job posted',
          body: `${j.title} · ${j.company || 'Company'}`,
          href: `/jobs/${j.id}`,
          sortAt: j.created_at,
        });
      }
    }

    /* --- Match score / match activity (recent matched_at) --- */
    if (role === 'candidate') {
      const matches = await query(
        env,
        `SELECT jm.id, jm.match_score, jm.matched_at, j.id as job_id, j.title, j.company
         FROM job_matches jm
         JOIN jobs j ON j.id = jm.job_id
         WHERE jm.candidate_id = ?
           AND datetime(jm.matched_at) > datetime('now', '-14 days')
         ORDER BY datetime(jm.matched_at) DESC
         LIMIT 15`,
        [uid]
      );
      for (const m of matches || []) {
        items.push({
          id: `match-${m.id}`,
          type: 'match_updated',
          title: 'Match score updated',
          body: `${m.title} · ${m.company || ''} — ${Math.round(Number(m.match_score))}%`,
          href: `/jobs/${m.job_id}`,
          sortAt: m.matched_at,
        });
      }
    } else if (role === 'consultant') {
      const matches = await query(
        env,
        `SELECT jm.id, jm.candidate_id, jm.match_score, jm.matched_at, j.id as job_id, j.title, j.company,
                u.first_name as cand_fn, u.last_name as cand_ln
         FROM job_matches jm
         JOIN jobs j ON j.id = jm.job_id
         JOIN consultant_assignments ca ON ca.candidate_id = jm.candidate_id AND ca.consultant_id = ?
         JOIN users u ON u.id = jm.candidate_id
         WHERE datetime(jm.matched_at) > datetime('now', '-14 days')
         ORDER BY datetime(jm.matched_at) DESC
         LIMIT 20`,
        [uid]
      );
      for (const m of matches || []) {
        items.push({
          id: `match-${m.id}`,
          type: 'match_updated',
          title: 'Match updated',
          body: `${m.cand_fn} ${m.cand_ln} — ${m.title} (${Math.round(Number(m.match_score))}%)`,
          href: `/candidates/${m.candidate_id}`,
          sortAt: m.matched_at,
        });
      }
    } else if (role === 'admin') {
      const matches = await query(
        env,
        `SELECT jm.id, jm.match_score, jm.matched_at, jm.candidate_id, j.id as job_id, j.title, j.company,
                u.first_name as cand_fn, u.last_name as cand_ln
         FROM job_matches jm
         JOIN jobs j ON j.id = jm.job_id
         JOIN users u ON u.id = jm.candidate_id
         WHERE datetime(jm.matched_at) > datetime('now', '-7 days')
         ORDER BY datetime(jm.matched_at) DESC
         LIMIT 25`,
        []
      );
      for (const m of matches || []) {
        items.push({
          id: `match-${m.id}`,
          type: 'match_updated',
          title: 'Match activity',
          body: `${m.cand_fn} ${m.cand_ln} — ${m.title} (${Math.round(Number(m.match_score))}%)`,
          href: `/candidates/${m.candidate_id}`,
          sortAt: m.matched_at,
        });
      }
    }

    /* --- CRM: overdue tasks, overdue follow-ups, upcoming --- */
    if (role === 'consultant') {
      const overdueTasks = await query(
        env,
        `SELECT c.id, c.interaction_type, c.follow_up_date, c.notes,
                u.first_name as fn, u.last_name as ln
         FROM crm_contacts c
         JOIN users u ON u.id = c.candidate_id
         WHERE c.consultant_id = ?
           AND c.interaction_type = 'task'
           AND c.follow_up_date IS NOT NULL
           AND date(c.follow_up_date) < date('now')
           AND IFNULL(c.status, 'open') NOT IN ('completed', 'cancelled')
         ORDER BY date(c.follow_up_date) ASC
         LIMIT 15`,
        [uid]
      );
      for (const c of overdueTasks || []) {
        items.push({
          id: `crm-task-${c.id}`,
          type: 'task_overdue',
          title: 'Overdue task',
          body: `${c.fn} ${c.ln} — ${truncate(c.notes, 80)}`,
          href: '/crm',
          sortAt: c.follow_up_date,
        });
      }

      const overdueFollow = await query(
        env,
        `SELECT c.id, c.interaction_type, c.follow_up_date, c.notes,
                u.first_name as fn, u.last_name as ln
         FROM crm_contacts c
         JOIN users u ON u.id = c.candidate_id
         WHERE c.consultant_id = ?
           AND c.interaction_type != 'task'
           AND c.follow_up_date IS NOT NULL
           AND date(c.follow_up_date) < date('now')
           AND IFNULL(c.status, 'open') NOT IN ('completed', 'cancelled')
         ORDER BY date(c.follow_up_date) ASC
         LIMIT 15`,
        [uid]
      );
      for (const c of overdueFollow || []) {
        items.push({
          id: `crm-overdue-${c.id}`,
          type: 'followup_overdue',
          title: 'Overdue follow-up',
          body: `${labelType(c.interaction_type)} · ${c.fn} ${c.ln}`,
          href: '/crm',
          sortAt: c.follow_up_date,
        });
      }

      const upcoming = await query(
        env,
        `SELECT c.id, c.interaction_type, c.follow_up_date, c.notes,
                u.first_name as fn, u.last_name as ln
         FROM crm_contacts c
         JOIN users u ON u.id = c.candidate_id
         WHERE c.consultant_id = ?
           AND c.follow_up_date IS NOT NULL
           AND date(c.follow_up_date) >= date('now')
           AND date(c.follow_up_date) <= date('now', '+10 days')
           AND IFNULL(c.status, 'open') NOT IN ('completed', 'cancelled')
         ORDER BY date(c.follow_up_date) ASC
         LIMIT 20`,
        [uid]
      );
      for (const c of upcoming || []) {
        items.push({
          id: `crm-up-${c.id}`,
          type: 'crm_upcoming',
          title: upcomingTitle(c.interaction_type),
          body: `${c.fn} ${c.ln} — ${fmtDate(c.follow_up_date)}`,
          href: '/crm',
          sortAt: c.follow_up_date,
        });
      }
    } else if (role === 'admin') {
      const overdueAll = await query(
        env,
        `SELECT c.id, c.interaction_type, c.follow_up_date,
                u.first_name as fn, u.last_name as ln,
                uc.first_name as owner_fn, uc.last_name as owner_ln
         FROM crm_contacts c
         JOIN users u ON u.id = c.candidate_id
         LEFT JOIN users uc ON uc.id = c.consultant_id
         WHERE c.follow_up_date IS NOT NULL
           AND date(c.follow_up_date) < date('now')
           AND IFNULL(c.status, 'open') NOT IN ('completed', 'cancelled')
         ORDER BY date(c.follow_up_date) ASC
         LIMIT 20`,
        []
      );
      for (const c of overdueAll || []) {
        items.push({
          id: `crm-overdue-${c.id}`,
          type: c.interaction_type === 'task' ? 'task_overdue' : 'followup_overdue',
          title: c.interaction_type === 'task' ? 'Overdue task' : 'Overdue follow-up',
          body: `${c.fn} ${c.ln}${c.owner_fn ? ` · ${c.owner_fn} ${c.owner_ln}` : ''}`,
          href: '/crm',
          sortAt: c.follow_up_date,
        });
      }

      const upcomingAll = await query(
        env,
        `SELECT c.id, c.interaction_type, c.follow_up_date,
                u.first_name as fn, u.last_name as ln
         FROM crm_contacts c
         JOIN users u ON u.id = c.candidate_id
         WHERE c.follow_up_date IS NOT NULL
           AND date(c.follow_up_date) >= date('now')
           AND date(c.follow_up_date) <= date('now', '+10 days')
           AND IFNULL(c.status, 'open') NOT IN ('completed', 'cancelled')
         ORDER BY date(c.follow_up_date) ASC
         LIMIT 25`,
        []
      );
      for (const c of upcomingAll || []) {
        items.push({
          id: `crm-up-${c.id}`,
          type: 'crm_upcoming',
          title: upcomingTitle(c.interaction_type),
          body: `${c.fn} ${c.ln} — ${fmtDate(c.follow_up_date)}`,
          href: '/crm',
          sortAt: c.follow_up_date,
        });
      }
    }

    /* --- Timesheets: pending approval (admin), draft reminder (consultant) --- */
    if (role === 'admin') {
      const pending = await query(
        env,
        `SELECT t.id, t.date, t.hours, t.description, t.submitted_at,
                u.first_name as fn, u.last_name as ln
         FROM timesheets t
         JOIN users u ON u.id = t.user_id
         WHERE t.status = 'submitted'
         ORDER BY datetime(IFNULL(t.submitted_at, t.updated_at)) DESC
         LIMIT 20`,
        []
      );
      for (const t of pending || []) {
        items.push({
          id: `ts-pending-${t.id}`,
          type: 'timesheet_approval',
          title: 'Timesheet pending approval',
          body: `${t.fn} ${t.ln} — ${t.date} (${t.hours}h)`,
          href: '/timesheets',
          sortAt: t.submitted_at || t.date,
        });
      }
    }

    if (role === 'consultant') {
      const draftRows = await query(
        env,
        `SELECT COUNT(*) as c, IFNULL(SUM(hours), 0) as hrs, MAX(updated_at) as latest
         FROM timesheets WHERE user_id = ? AND status = 'draft'`,
        [uid]
      );
      const c = Number(draftRows?.[0]?.c || 0);
      const hrs = draftRows?.[0]?.hrs;
      const latestDraft = draftRows?.[0]?.latest;
      if (c > 0) {
        items.push({
          id: 'timesheet-drafts-summary',
          type: 'timesheet_drafts',
          title: 'Draft timesheets',
          body: `${c} draft entr${c === 1 ? 'y' : 'ies'} (${Number(hrs).toFixed(1)}h) not submitted`,
          href: '/timesheets',
          sortAt: latestDraft || new Date().toISOString(),
        });
      }

      const submittedOwn = await query(
        env,
        `SELECT id, date, hours, submitted_at FROM timesheets
         WHERE user_id = ? AND status = 'submitted'
           AND datetime(IFNULL(submitted_at, updated_at)) > datetime('now', '-7 days')
         ORDER BY datetime(IFNULL(submitted_at, updated_at)) DESC LIMIT 5`,
        [uid]
      );
      for (const t of submittedOwn || []) {
        items.push({
          id: `ts-sent-${t.id}`,
          type: 'timesheet_submitted',
          title: 'Timesheet submitted',
          body: `${t.date} · ${t.hours}h — awaiting approval`,
          href: '/timesheets',
          sortAt: t.submitted_at || t.date,
        });
      }
    }

    /* --- New candidates --- */
    if (role === 'admin') {
      const cand = await query(
        env,
        `SELECT id, first_name, last_name, email, created_at
         FROM users
         WHERE role = 'candidate'
           AND datetime(created_at) > datetime('now', '-21 days')
           AND IFNULL(is_active, 1) = 1
         ORDER BY datetime(created_at) DESC
         LIMIT 15`,
        []
      );
      for (const u of cand || []) {
        items.push({
          id: `cand-new-${u.id}`,
          type: 'new_candidate',
          title: 'New candidate',
          body: `${u.first_name} ${u.last_name}`,
          href: `/candidates/${u.id}`,
          sortAt: u.created_at,
        });
      }
    } else if (role === 'consultant') {
      const cand = await query(
        env,
        `SELECT u.id, u.first_name, u.last_name, u.email, ca.assigned_at
         FROM consultant_assignments ca
         JOIN users u ON u.id = ca.candidate_id
         WHERE ca.consultant_id = ?
           AND datetime(ca.assigned_at) > datetime('now', '-21 days')
         ORDER BY datetime(ca.assigned_at) DESC
         LIMIT 15`,
        [uid]
      );
      for (const u of cand || []) {
        items.push({
          id: `cand-assign-${u.id}`,
          type: 'new_candidate',
          title: 'Candidate assigned to you',
          body: `${u.first_name} ${u.last_name}`,
          href: `/candidates/${u.id}`,
          sortAt: u.assigned_at,
        });
      }
    }

    return sortItems(items);
}

export async function handleNotifications(request, env, user) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (!path.startsWith('/api/notifications')) {
    return addCorsHeaders(
      new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } }),
      env,
      request
    );
  }

  if (!user?.id) {
    return json(env, request, { error: 'Unauthorized' }, 401);
  }

  try {
    if (path === '/api/notifications/seen' && method === 'POST') {
      await markNotificationsSeen(env, user.id);
      return json(env, request, { success: true });
    }

    if (path === '/api/notifications/clear' && method === 'POST') {
      const allItems = await collectNotifications(env, user);
      await dismissNotificationIds(env, user.id, allItems.map((item) => item.id));
      await markNotificationsSeen(env, user.id);
      return json(env, request, { success: true, cleared: allItems.length });
    }

    if (path === '/api/notifications' && method === 'GET') {
      const [allItems, lastSeenAt, dismissedIds] = await Promise.all([
        collectNotifications(env, user),
        getLastSeenAt(env, user.id),
        getDismissedIds(env, user.id),
      ]);

      const visible = allItems
        .filter((item) => !dismissedIds.has(item.id))
        .map((item) => ({
          ...item,
          unread: isUnread(item, lastSeenAt),
        }));

      return json(env, request, {
        notifications: visible,
        count: visible.length,
        unreadCount: countUnread(visible, lastSeenAt),
      });
    }

    return json(env, request, { error: 'Not found' }, 404);
  } catch (e) {
    console.error('handleNotifications', e);
    return json(env, request, { error: 'Server error', details: e.message }, 500);
  }
}

function truncate(s, n) {
  if (!s) return '';
  const t = String(s).trim();
  return t.length <= n ? t : `${t.slice(0, n)}…`;
}

function labelType(t) {
  if (!t) return 'Follow-up';
  return String(t).replace(/_/g, ' ');
}

function upcomingTitle(interactionType) {
  const t = (interactionType || '').toLowerCase();
  if (t === 'meeting' || t === 'video_call') return 'Upcoming meeting';
  if (t === 'call') return 'Upcoming call';
  if (t === 'interview') return 'Upcoming interview';
  if (t === 'task') return 'Upcoming task';
  return 'Upcoming follow-up';
}

function fmtDate(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return String(d);
  }
}
