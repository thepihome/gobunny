/**
 * CRM routes for Cloudflare Workers
 */

import { query, queryOne, execute } from '../utils/db.js';
import { addCorsHeaders } from '../utils/cors.js';
import { authorize } from '../middleware/auth.js';

export async function handleCRM(request, env, user) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Get all CRM interactions
  if (path === '/api/crm' && method === 'GET') {
    try {
      let sql = `SELECT c.*,
                 u.first_name as consultant_first_name, u.last_name as consultant_last_name, u.email as consultant_email,
                 c2.first_name as candidate_first_name, c2.last_name as candidate_last_name, c2.email as candidate_email
                 FROM crm_contacts c
                 LEFT JOIN users u ON c.consultant_id = u.id
                 LEFT JOIN users c2 ON c.candidate_id = c2.id
                 WHERE 1=1`;
      const params = [];

      // Consultants can only see their own interactions
      if (user.role === 'consultant') {
        sql += ' AND c.consultant_id = ?';
        params.push(user.id);
      }
      // Admins can see all

      sql += ' ORDER BY c.interaction_date DESC, c.created_at DESC';

      const interactions = await query(env, sql, params);

      return addCorsHeaders(
        new Response(
          JSON.stringify(interactions || []),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error fetching CRM interactions:', error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: 'Server error', details: error.message }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    }
  }

  // Create new CRM interaction
  if (path === '/api/crm' && method === 'POST') {
    const authError = authorize('consultant', 'admin')(user);
    if (authError) {
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: authError.error }),
          { status: authError.status, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    }

    try {
      const body = await request.json();
      const { candidate_id, interaction_type, interaction_date, notes, follow_up_date, status } = body;

      // Validation
      if (!candidate_id || !interaction_type || !interaction_date) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Candidate ID, interaction type, and date are required' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      const validTypes = ['call', 'email', 'meeting', 'note'];
      if (!validTypes.includes(interaction_type)) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: `Interaction type must be one of: ${validTypes.join(', ')}` }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Insert interaction
      const result = await execute(
        env,
        `INSERT INTO crm_contacts (consultant_id, candidate_id, interaction_type, interaction_date, notes, follow_up_date, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          user.id,
          candidate_id,
          interaction_type,
          interaction_date,
          notes || null,
          follow_up_date || null,
          status || 'open'
        ]
      );

      const interactionId = result.meta?.last_row_id || result.lastInsertRowid;

      // Fetch created interaction
      const interaction = await queryOne(
        env,
        `SELECT c.*,
         u.first_name as consultant_first_name, u.last_name as consultant_last_name, u.email as consultant_email,
         c2.first_name as candidate_first_name, c2.last_name as candidate_last_name, c2.email as candidate_email
         FROM crm_contacts c
         LEFT JOIN users u ON c.consultant_id = u.id
         LEFT JOIN users c2 ON c.candidate_id = c2.id
         WHERE c.id = ?`,
        [interactionId]
      );

      return addCorsHeaders(
        new Response(
          JSON.stringify(interaction),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error creating CRM interaction:', error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: 'Server error', details: error.message }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    }
  }

  // Update CRM interaction
  const updateMatch = path.match(/^\/api\/crm\/(\d+)$/);
  if (updateMatch && method === 'PUT') {
    const authError = authorize('consultant', 'admin')(user);
    if (authError) {
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: authError.error }),
          { status: authError.status, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    }

    try {
      const interactionId = updateMatch[1];
      const body = await request.json();
      const { candidate_id, interaction_type, interaction_date, notes, follow_up_date, status } = body;

      // Check if interaction exists
      const existing = await queryOne(
        env,
        'SELECT * FROM crm_contacts WHERE id = ?',
        [interactionId]
      );

      if (!existing) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Interaction not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Consultants can only update their own interactions
      if (user.role === 'consultant' && existing.consultant_id !== user.id) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Access denied' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Build update query
      const updateFields = [];
      const updateValues = [];

      if (candidate_id !== undefined) {
        updateFields.push('candidate_id = ?');
        updateValues.push(candidate_id);
      }
      if (interaction_type !== undefined) {
        const validTypes = ['call', 'email', 'meeting', 'note'];
        if (!validTypes.includes(interaction_type)) {
          return addCorsHeaders(
            new Response(
              JSON.stringify({ error: `Interaction type must be one of: ${validTypes.join(', ')}` }),
              { status: 400, headers: { 'Content-Type': 'application/json' } }
            ),
            env,
            request
          );
        }
        updateFields.push('interaction_type = ?');
        updateValues.push(interaction_type);
      }
      if (interaction_date !== undefined) {
        updateFields.push('interaction_date = ?');
        updateValues.push(interaction_date);
      }
      if (notes !== undefined) {
        updateFields.push('notes = ?');
        updateValues.push(notes || null);
      }
      if (follow_up_date !== undefined) {
        updateFields.push('follow_up_date = ?');
        updateValues.push(follow_up_date || null);
      }
      if (status !== undefined) {
        updateFields.push('status = ?');
        updateValues.push(status);
      }

      if (updateFields.length === 0) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'No fields to update' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      updateFields.push("updated_at = datetime('now')");
      updateValues.push(interactionId);

      await execute(
        env,
        `UPDATE crm_contacts SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );

      // Fetch updated interaction
      const updated = await queryOne(
        env,
        `SELECT c.*,
         u.first_name as consultant_first_name, u.last_name as consultant_last_name, u.email as consultant_email,
         c2.first_name as candidate_first_name, c2.last_name as candidate_last_name, c2.email as candidate_email
         FROM crm_contacts c
         LEFT JOIN users u ON c.consultant_id = u.id
         LEFT JOIN users c2 ON c.candidate_id = c2.id
         WHERE c.id = ?`,
        [interactionId]
      );

      return addCorsHeaders(
        new Response(
          JSON.stringify(updated),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error updating CRM interaction:', error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: 'Server error', details: error.message }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    }
  }

  // Delete CRM interaction
  if (updateMatch && method === 'DELETE') {
    const authError = authorize('consultant', 'admin')(user);
    if (authError) {
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: authError.error }),
          { status: authError.status, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    }

    try {
      const interactionId = updateMatch[1];

      // Check if interaction exists
      const existing = await queryOne(
        env,
        'SELECT * FROM crm_contacts WHERE id = ?',
        [interactionId]
      );

      if (!existing) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Interaction not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Consultants can only delete their own interactions
      if (user.role === 'consultant' && existing.consultant_id !== user.id) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Access denied' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      await execute(
        env,
        'DELETE FROM crm_contacts WHERE id = ?',
        [interactionId]
      );

      return addCorsHeaders(
        new Response(
          JSON.stringify({ message: 'Interaction deleted successfully' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Error deleting CRM interaction:', error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: 'Server error', details: error.message }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    }
  }

  // Default: endpoint not found
  return addCorsHeaders(
    new Response(
      JSON.stringify({ error: 'Endpoint not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    ),
    env,
    request
  );
}
