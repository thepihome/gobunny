/**
 * Authentication routes for Cloudflare Workers
 */

import { queryOne, execute } from '../utils/db.js';
import { addCorsHeaders } from '../utils/cors.js';
import {
  hashPassword,
  comparePassword,
  createJWT,
  needsPasswordRehash,
} from '../utils/crypto.js';
import { queueTransactionalEmail } from '../utils/emailService.js';

export async function handleAuth(request, env, ctx) {
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
      console.log('Registration body:', { email: body.email, first_name: body.first_name, last_name: body.last_name });
      const { email, password, first_name, last_name, phone } = body;

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

      // Insert user - always set role to 'candidate' for registrations (ignore any role sent from frontend)
      console.log('Attempting to insert user:', { email, first_name, last_name, role: 'candidate' });
      
      let result;
      try {
        result = await execute(
          env,
          `INSERT INTO users (email, password_hash, first_name, last_name, role, phone)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [email, password_hash, first_name, last_name, 'candidate', phone || null]
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

      // Create candidate profile if user is a candidate
      if (user.role === 'candidate') {
        try {
          await execute(
            env,
            `INSERT INTO candidate_profiles (user_id) VALUES (?)`,
            [userId]
          );
          console.log('Candidate profile created for user ID:', userId);
        } catch (profileError) {
          console.error('Error creating candidate profile:', profileError);
          // Don't fail registration if profile creation fails, but log it
          // The profile can be created later if needed
        }
      }

      // Generate token
      const token = await createJWT(
        { userId: user.id },
        env.JWT_SECRET,
        env.JWT_EXPIRE || '7d'
      );

      queueTransactionalEmail(ctx, env, 'user_signup', user.email, {
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
      });

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

  // Google Sign-In (only for users already in users table)
  if (path === '/api/auth/google' && method === 'POST') {
    try {
      const body = await request.json();
      const { credential } = body;
      if (!credential) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Missing credential' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }
      const clientId = env.GOOGLE_CLIENT_ID;
      if (!clientId) {
        console.error('GOOGLE_CLIENT_ID not configured');
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Server configuration error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }
      const tokenRes = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
      );
      if (!tokenRes.ok) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Invalid Google credential' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }
      const payload = await tokenRes.json();
      if (payload.aud !== clientId) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Invalid Google credential' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }
      const email = payload.email;
      if (!email) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Email not provided by Google' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          ),
          env,
          request
        );
      }
      const user = await queryOne(
        env,
        'SELECT id, email, first_name, last_name, role, is_active FROM users WHERE email = ?',
        [email]
      );
      if (!user) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: 'Access denied. Your account is not authorized to use this app.' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
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
      const token = await createJWT(
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
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error('Google auth error:', error);
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

      if (needsPasswordRehash(user.password_hash)) {
        const newHash = await hashPassword(password);
        await execute(
          env,
          `UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`,
          [newHash, user.id]
        );
      }

      // Generate token
      const token = await createJWT(
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

