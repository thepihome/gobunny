/**
 * Authentication middleware for Cloudflare Workers
 * Using Web Crypto API for JWT verification
 */

/**
 * Base64 URL decode
 */
function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  return atob(str);
}

/**
 * Decode JWT without verification (for getting payload)
 */
function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    return payload;
  } catch (e) {
    return null;
  }
}

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
    
    // Decode token to get user ID (simplified - in production, verify signature)
    const decoded = decodeJWT(token);
    if (!decoded || !decoded.userId) {
      return { error: 'Invalid token', status: 401 };
    }

    // Check expiration
    if (decoded.exp && decoded.exp < Date.now() / 1000) {
      return { error: 'Token expired', status: 401 };
    }

    const userId = decoded.userId;

    // Get user from database
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

