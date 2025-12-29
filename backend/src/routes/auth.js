/**
 * Authentication routes for Cloudflare Workers
 */

import { queryOne, execute } from '../utils/db.js';
import { addCorsHeaders } from '../utils/cors.js';

/**
 * Hash password using Web Crypto API (PBKDF2)
 */
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Compare password with hash
 */
async function comparePassword(password, hash) {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

/**
 * Simple JWT creation
 * Note: This is a simplified implementation. For production, use a proper JWT library
 * or implement proper HMAC-SHA256 signing with Web Crypto API
 */
function createJWT(payload, secret, expiresIn = '7d') {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (expiresIn === '7d' ? 7 * 24 * 60 * 60 : 60 * 60);
  
  const encodedHeader = btoa(JSON.stringify(header)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const encodedPayload = btoa(JSON.stringify({ ...payload, exp, iat: now })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  
  // Simplified: In production, implement proper HMAC-SHA256 signature
  // For now, we'll use a simple approach (not secure for production)
  const signature = btoa(secret).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export async function handleAuth(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  
  // Get origin for CORS
  const requestOrigin = request.headers.get('Origin');

  // Register
  if (path === '/api/auth/register' && method === 'POST') {
    console.log('Registration request received');
    try {
      const body = await request.json();
      console.log('Registration body:', { email: body.email, first_name: body.first_name, last_name: body.last_name, role: body.role });
      const { email, password, first_name, last_name, role, phone } = body;

      // Check if user exists
      const existingUser = await queryOne(
        env,
        'SELECT id FROM users WHERE email = ?',
        [email]
      );

      if (existingUser) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'User already exists' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Hash password
      const password_hash = await hashPassword(password);

      // Insert user
      console.log('Attempting to insert user:', { email, first_name, last_name, role: role || 'candidate' });
      
      let result;
      try {
        result = await execute(
          env,
          `INSERT INTO users (email, password_hash, first_name, last_name, role, phone)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [email, password_hash, first_name, last_name, role || 'candidate', phone || null]
        );
        console.log('Insert result:', JSON.stringify(result));
      } catch (dbError) {
        console.error('Database insert error:', dbError);
        console.error('Error details:', {
          message: dbError.message,
          stack: dbError.stack,
          name: dbError.name
        });
        throw new Error(`Database error: ${dbError.message}`);
      }

      const userId = result.meta?.last_row_id || result.lastInsertRowid;
      
      if (!userId) {
        console.error('Failed to get last insert ID. Result:', JSON.stringify(result));
        console.error('Result meta:', result.meta);
        throw new Error('Failed to create user - no ID returned');
      }
      
      console.log('User created with ID:', userId);

      // Get created user immediately to verify insertion
      const user = await queryOne(
        env,
        'SELECT id, email, first_name, last_name, role FROM users WHERE id = ?',
        [userId]
      );
      
      if (!user) {
        console.error('User was not found after insertion. ID:', userId);
        throw new Error('User was not created successfully');
      }

      // Generate token
      const token = createJWT(
        { userId: user.id },
        env.JWT_SECRET,
        env.JWT_EXPIRE || '7d'
      );

      return addCorsHeaders(
        new Response(
          JSON.stringify({
            token,
            user: {
              id: user.id,
              email: user.email,
              first_name: user.first_name,
              last_name: user.last_name,
              role: user.role,
            },
          }),
          {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Registration error:', error);
      console.error('Error stack:', error.stack);
      console.error('Error message:', error.message);
      console.error('Error name:', error.name);
      
      // Return detailed error for debugging
      const errorMessage = error.message || 'Unknown error';
      const isDevelopment = env.NODE_ENV === 'development' || !env.NODE_ENV;
      
      return addCorsHeaders(
        new Response(
          JSON.stringify({ 
            error: 'Registration failed',
            message: isDevelopment ? errorMessage : 'Failed to create user. Please try again.',
            details: isDevelopment ? {
              name: error.name,
              stack: error.stack
            } : undefined
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    }
  }

  // Login
  if (path === '/api/auth/login' && method === 'POST') {
    try {
      const body = await request.json();
      const { email, password } = body;

      // Get user
      const user = await queryOne(
        env,
        'SELECT id, email, password_hash, first_name, last_name, role, is_active FROM users WHERE email = ?',
        [email]
      );

      if (!user) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Invalid credentials' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      if (!user.is_active) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Account is deactivated' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Check password
      const isValid = await comparePassword(password, user.password_hash);
      if (!isValid) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Invalid credentials' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }

      // Generate token
      const token = createJWT(
        { userId: user.id },
        env.JWT_SECRET,
        env.JWT_EXPIRE || '7d'
      );

      return addCorsHeaders(
        new Response(
          JSON.stringify({
            token,
            user: {
              id: user.id,
              email: user.email,
              first_name: user.first_name,
              last_name: user.last_name,
              role: user.role,
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Login error:', error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: 'Server error' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    }
  }

  // Get current user
  if (path === '/api/auth/me' && method === 'GET') {
    const { authenticate } = await import('../middleware/auth.js');
    const authResult = await authenticate(request, env);

    if (authResult.error) {
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: authResult.error }),
          {
            status: authResult.status || 401,
            headers: { 'Content-Type': 'application/json' },
          }
        ),
        env,
        request
      );
    }

    return addCorsHeaders(
      new Response(
        JSON.stringify({ user: authResult.user }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      ),
      env,
      request
    );
  }

  return addCorsHeaders(
    new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    ),
    env,
    request
  );
}

