/**
 * Activity logging utility for tracking dashboard activities
 */

import { execute } from './db.js';

/**
 * Log an activity
 * @param {Object} env - Environment object with DB
 * @param {Object} params - Log parameters
 * @param {number} params.userId - User ID performing the action
 * @param {string} params.entityType - Type of entity ('candidate_profile', 'user', 'job', etc.)
 * @param {number} params.entityId - ID of the entity
 * @param {string} params.action - Action performed ('create', 'update', 'delete', 'view')
 * @param {string} [params.fieldName] - Field name being changed (for updates)
 * @param {string} [params.oldValue] - Previous value (for updates)
 * @param {string} [params.newValue] - New value (for updates)
 * @param {string} [params.description] - Human-readable description
 * @param {Object} [params.metadata] - Additional context (will be JSON stringified)
 * @param {Request} [params.request] - Request object for IP and user agent
 */
export async function logActivity(env, params) {
  try {
    const {
      userId,
      entityType,
      entityId,
      action,
      fieldName = null,
      oldValue = null,
      newValue = null,
      description = null,
      metadata = null,
      request = null
    } = params;

    // Extract IP and user agent from request if provided
    let ipAddress = null;
    let userAgent = null;
    if (request) {
      // Get IP from various headers (Cloudflare Workers)
      ipAddress = request.headers.get('CF-Connecting-IP') || 
                  request.headers.get('X-Forwarded-For') || 
                  request.headers.get('X-Real-IP') || 
                  null;
      userAgent = request.headers.get('User-Agent') || null;
    }

    // Stringify metadata if it's an object
    const metadataStr = metadata ? JSON.stringify(metadata) : null;

    // Truncate values if too long (SQLite TEXT limit considerations)
    const truncate = (str, maxLen = 1000) => {
      if (!str) return null;
      const s = String(str);
      return s.length > maxLen ? s.substring(0, maxLen) + '...' : s;
    };

    await execute(
      env,
      `INSERT INTO activity_logs (
        user_id, entity_type, entity_id, action, field_name, 
        old_value, new_value, description, metadata, 
        ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        entityType,
        entityId,
        action,
        fieldName,
        truncate(oldValue),
        truncate(newValue),
        truncate(description, 2000),
        metadataStr,
        ipAddress,
        truncate(userAgent, 500)
      ]
    );
  } catch (error) {
    // Don't fail the main operation if logging fails
    console.error('Error logging activity:', error);
  }
}

/**
 * Compare two objects and log changes
 * @param {Object} env - Environment object with DB
 * @param {Object} params - Log parameters
 * @param {number} params.userId - User ID performing the action
 * @param {string} params.entityType - Type of entity
 * @param {number} params.entityId - ID of the entity
 * @param {Object} params.oldData - Previous data
 * @param {Object} params.newData - New data
 * @param {Request} [params.request] - Request object
 */
export async function logChanges(env, params) {
  const { userId, entityType, entityId, oldData, newData, request } = params;
  
  const changes = [];
  const allKeys = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]);
  
  for (const key of allKeys) {
    const oldVal = oldData?.[key];
    const newVal = newData?.[key];
    
    // Skip if values are the same
    if (oldVal === newVal) continue;
    
    // Skip internal fields
    if (['id', 'created_at', 'updated_at'].includes(key)) continue;
    
    // Format values for display
    const formatValue = (val) => {
      if (val === null || val === undefined) return null;
      if (typeof val === 'object') return JSON.stringify(val);
      return String(val);
    };
    
    changes.push({
      fieldName: key,
      oldValue: formatValue(oldVal),
      newValue: formatValue(newVal)
    });
  }
  
  if (changes.length === 0) {
    // No changes, just log the update action
    await logActivity(env, {
      userId,
      entityType,
      entityId,
      action: 'update',
      description: `${entityType} updated (no field changes detected)`,
      request
    });
    return;
  }
  
  // Log each change
  for (const change of changes) {
    await logActivity(env, {
      userId,
      entityType,
      entityId,
      action: 'update',
      fieldName: change.fieldName,
      oldValue: change.oldValue,
      newValue: change.newValue,
      description: `${change.fieldName} changed from "${change.oldValue || 'empty'}" to "${change.newValue || 'empty'}"`,
      request
    });
  }
  
  // Also log a summary
  await logActivity(env, {
    userId,
    entityType,
    entityId,
    action: 'update',
    description: `${entityType} updated: ${changes.length} field(s) changed`,
    metadata: { changedFields: changes.map(c => c.fieldName) },
    request
  });
}

