/**
 * Database utilities for D1
 */

/**
 * Execute a query with parameters (SELECT)
 */
export async function query(env, sql, params = []) {
  try {
    let stmt = env.DB.prepare(sql);
    
    // Bind parameters if provided
    if (params.length > 0) {
      stmt = stmt.bind(...params);
    }
    
    const result = await stmt.all();
    return result.results || [];
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

/**
 * Execute a query and return first row
 */
export async function queryOne(env, sql, params = []) {
  const results = await query(env, sql, params);
  return results[0] || null;
}

/**
 * Execute an INSERT/UPDATE/DELETE and return the last insert ID
 */
export async function execute(env, sql, params = []) {
  try {
    let stmt = env.DB.prepare(sql);
    
    if (params.length > 0) {
      stmt = stmt.bind(...params);
    }
    
    const result = await stmt.run();
    return { 
      success: true, 
      meta: result.meta,
      lastInsertRowid: result.meta.last_row_id 
    };
  } catch (error) {
    console.error('Database execute error:', error);
    throw error;
  }
}

/**
 * Parse JSON fields from database results
 */
export function parseJsonFields(row, fields = []) {
  const parsed = { ...row };
  fields.forEach(field => {
    if (parsed[field] && typeof parsed[field] === 'string') {
      try {
        parsed[field] = JSON.parse(parsed[field]);
      } catch (e) {
        parsed[field] = [];
      }
    }
  });
  return parsed;
}

/**
 * Stringify JSON fields for database storage
 */
export function stringifyJsonFields(data, fields = []) {
  const stringified = { ...data };
  fields.forEach(field => {
    if (stringified[field] && typeof stringified[field] === 'object') {
      stringified[field] = JSON.stringify(stringified[field]);
    }
  });
  return stringified;
}

