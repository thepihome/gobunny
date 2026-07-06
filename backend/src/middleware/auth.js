/**
 * Authentication middleware for Cloudflare Workers
 */

import { verifyJWT } from '../utils/crypto.js';

/**
 * Authenticate request using JWT token
 */
export async function authenticate(request, env) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { error: 'No token provided', status: 401 };
    }

    const token = authHeader.substring(7);
    const secret = env.JWT_SECRET;
    if (!secret) {
      console.error('JWT_SECRET not configured');
      return { error: 'Server configuration error', status: 500 };
    }

    const decoded = await verifyJWT(token, secret);
    if (!decoded || !decoded.userId) {
      return { error: 'Invalid token', status: 401 };
    }

    const userId = decoded.userId;

    const { queryOne } = await import('../utils/db.js');
    const user = await queryOne(
      env,
      'SELECT id, email, first_name, last_name, role, is_active FROM users WHERE id = ?',
      [userId]
    );

    if (!user || !user.is_active) {
      return { error: 'Invalid token', status: 401 };
    }

    return { user };
  } catch (error) {
    console.error('Authentication error:', error);
    return { error: 'Invalid token', status: 401 };
  }
}

/**
 * Authorize user based on roles
 */
export function authorize(...allowedRoles) {
  return (user) => {
    if (!user) {
      return { error: 'Authentication required', status: 401 };
    }

    if (!allowedRoles.includes(user.role)) {
      return { error: 'Insufficient permissions', status: 403 };
    }

    return null;
  };
}

/**
 * Returns true when the user may access their own record or is admin
 */
export function isSelfOrAdmin(user, targetUserId) {
  return user.role === 'admin' || user.id === parseInt(targetUserId, 10);
}
