var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/utils/db.js
var db_exports = {};
__export(db_exports, {
  execute: () => execute,
  parseJsonFields: () => parseJsonFields,
  query: () => query,
  queryOne: () => queryOne,
  stringifyJsonFields: () => stringifyJsonFields
});
async function query(env, sql, params = []) {
  try {
    let stmt = env.DB.prepare(sql);
    if (params.length > 0) {
      stmt = stmt.bind(...params);
    }
    const result = await stmt.all();
    return result.results || [];
  } catch (error) {
    console.error("Database query error:", error);
    throw error;
  }
}
async function queryOne(env, sql, params = []) {
  const results = await query(env, sql, params);
  return results[0] || null;
}
async function execute(env, sql, params = []) {
  try {
    let stmt = env.DB.prepare(sql);
    if (params.length > 0) {
      stmt = stmt.bind(...params);
    }
    const result = await stmt.run();
    console.log("D1 execute result:", JSON.stringify(result));
    const lastRowId = result.meta?.last_row_id ?? null;
    if (!lastRowId && result.meta) {
      console.warn("No last_row_id in result.meta. Full meta:", JSON.stringify(result.meta));
    }
    return {
      success: true,
      meta: {
        ...result.meta,
        last_row_id: lastRowId
      },
      lastInsertRowid: lastRowId,
      rawResult: result
      // Include for debugging
    };
  } catch (error) {
    console.error("Database execute error:", error);
    console.error("SQL:", sql);
    console.error("Params:", params);
    throw error;
  }
}
function parseJsonFields(row, fields = []) {
  const parsed = { ...row };
  fields.forEach((field) => {
    if (parsed[field] && typeof parsed[field] === "string") {
      try {
        parsed[field] = JSON.parse(parsed[field]);
      } catch (e) {
        parsed[field] = [];
      }
    }
  });
  return parsed;
}
function stringifyJsonFields(data, fields = []) {
  const stringified = { ...data };
  fields.forEach((field) => {
    if (stringified[field] && typeof stringified[field] === "object") {
      stringified[field] = JSON.stringify(stringified[field]);
    }
  });
  return stringified;
}
var init_db = __esm({
  "src/utils/db.js"() {
    __name(query, "query");
    __name(queryOne, "queryOne");
    __name(execute, "execute");
    __name(parseJsonFields, "parseJsonFields");
    __name(stringifyJsonFields, "stringifyJsonFields");
  }
});

// src/middleware/auth.js
var auth_exports = {};
__export(auth_exports, {
  authenticate: () => authenticate,
  authorize: () => authorize
});
function base64UrlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) {
    str += "=";
  }
  return atob(str);
}
function decodeJWT(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    return payload;
  } catch (e) {
    return null;
  }
}
async function authenticate(request, env) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return { error: "No token provided", status: 401 };
    }
    const token = authHeader.substring(7);
    const decoded = decodeJWT(token);
    if (!decoded || !decoded.userId) {
      return { error: "Invalid token", status: 401 };
    }
    if (decoded.exp && decoded.exp < Date.now() / 1e3) {
      return { error: "Token expired", status: 401 };
    }
    const userId = decoded.userId;
    const { queryOne: queryOne2 } = await Promise.resolve().then(() => (init_db(), db_exports));
    const user = await queryOne2(
      env,
      "SELECT id, email, first_name, last_name, role, is_active FROM users WHERE id = ?",
      [userId]
    );
    if (!user || !user.is_active) {
      return { error: "Invalid token", status: 401 };
    }
    return { user };
  } catch (error) {
    console.error("Authentication error:", error);
    return { error: "Invalid token", status: 401 };
  }
}
function authorize(...allowedRoles) {
  return (user) => {
    if (!user) {
      return { error: "Authentication required", status: 401 };
    }
    if (!allowedRoles.includes(user.role)) {
      return { error: "Insufficient permissions", status: 403 };
    }
    return null;
  };
}
var init_auth = __esm({
  "src/middleware/auth.js"() {
    __name(base64UrlDecode, "base64UrlDecode");
    __name(decodeJWT, "decodeJWT");
    __name(authenticate, "authenticate");
    __name(authorize, "authorize");
  }
});

// src/routes/auth.js
init_db();

// src/utils/cors.js
function normalizeOrigin(origin) {
  if (!origin) return origin;
  return origin.replace(/\/$/, "");
}
__name(normalizeOrigin, "normalizeOrigin");
function getCorsHeaders(env, requestOrigin = null) {
  const allowedOrigin = normalizeOrigin(env.FRONTEND_URL || "*");
  let origin = "*";
  if (requestOrigin) {
    const normalizedRequestOrigin = normalizeOrigin(requestOrigin);
    if (allowedOrigin === "*" || normalizedRequestOrigin === allowedOrigin) {
      origin = normalizedRequestOrigin;
    }
  } else if (allowedOrigin !== "*") {
    origin = allowedOrigin;
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true"
  };
}
__name(getCorsHeaders, "getCorsHeaders");
function getOriginFromRequest(request) {
  if (typeof request === "string") {
    return request;
  }
  if (request && typeof request === "object" && "headers" in request) {
    return request.headers.get("Origin");
  }
  return null;
}
__name(getOriginFromRequest, "getOriginFromRequest");
function handleCORS(env, requestOrOrigin = null) {
  const requestOrigin = getOriginFromRequest(requestOrOrigin);
  const headers = getCorsHeaders(env, requestOrigin);
  return new Response(null, {
    status: 204,
    headers
  });
}
__name(handleCORS, "handleCORS");
function addCorsHeaders(response, env, requestOrOrigin = null) {
  const requestOrigin = getOriginFromRequest(requestOrOrigin);
  const headers = getCorsHeaders(env, requestOrigin);
  const newHeaders = new Headers(response.headers);
  Object.entries(headers).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}
__name(addCorsHeaders, "addCorsHeaders");

// src/routes/auth.js
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(hashPassword, "hashPassword");
async function comparePassword(password, hash) {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}
__name(comparePassword, "comparePassword");
function createJWT(payload, secret, expiresIn = "7d") {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1e3);
  const exp = now + (expiresIn === "7d" ? 7 * 24 * 60 * 60 : 60 * 60);
  const encodedHeader = btoa(JSON.stringify(header)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  const encodedPayload = btoa(JSON.stringify({ ...payload, exp, iat: now })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  const signature = btoa(secret).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}
__name(createJWT, "createJWT");
async function handleAuth(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  const requestOrigin = request.headers.get("Origin");
  if (path === "/api/auth/register" && method === "POST") {
    console.log("Registration request received");
    try {
      const body = await request.json();
      console.log("Registration body:", { email: body.email, first_name: body.first_name, last_name: body.last_name, role: body.role });
      const { email, password, first_name, last_name, role, phone } = body;
      const existingUser = await queryOne(
        env,
        "SELECT id FROM users WHERE email = ?",
        [email]
      );
      if (existingUser) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: "User already exists" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          ),
          env,
          request
        );
      }
      const password_hash = await hashPassword(password);
      console.log("Attempting to insert user:", { email, first_name, last_name, role: role || "candidate" });
      let result;
      try {
        result = await execute(
          env,
          `INSERT INTO users (email, password_hash, first_name, last_name, role, phone)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [email, password_hash, first_name, last_name, role || "candidate", phone || null]
        );
        console.log("Insert result:", JSON.stringify(result));
      } catch (dbError) {
        console.error("Database insert error:", dbError);
        console.error("Error details:", {
          message: dbError.message,
          stack: dbError.stack,
          name: dbError.name
        });
        throw new Error(`Database error: ${dbError.message}`);
      }
      const userId = result.meta?.last_row_id || result.lastInsertRowid;
      if (!userId) {
        console.error("Failed to get last insert ID. Result:", JSON.stringify(result));
        console.error("Result meta:", result.meta);
        throw new Error("Failed to create user - no ID returned");
      }
      console.log("User created with ID:", userId);
      const user = await queryOne(
        env,
        "SELECT id, email, first_name, last_name, role FROM users WHERE id = ?",
        [userId]
      );
      if (!user) {
        console.error("User was not found after insertion. ID:", userId);
        throw new Error("User was not created successfully");
      }
      if (user.role === "candidate") {
        try {
          await execute(
            env,
            `INSERT INTO candidate_profiles (user_id) VALUES (?)`,
            [userId]
          );
          console.log("Candidate profile created for user ID:", userId);
        } catch (profileError) {
          console.error("Error creating candidate profile:", profileError);
        }
      }
      const token = createJWT(
        { userId: user.id },
        env.JWT_SECRET,
        env.JWT_EXPIRE || "7d"
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
              role: user.role
            }
          }),
          {
            status: 201,
            headers: { "Content-Type": "application/json" }
          }
        ),
        env,
        request
      );
    } catch (error) {
      console.error("Registration error:", error);
      console.error("Error stack:", error.stack);
      console.error("Error message:", error.message);
      console.error("Error name:", error.name);
      const errorMessage = error.message || "Unknown error";
      const isDevelopment = env.NODE_ENV === "development" || !env.NODE_ENV;
      return addCorsHeaders(
        new Response(
          JSON.stringify({
            error: "Registration failed",
            message: isDevelopment ? errorMessage : "Failed to create user. Please try again.",
            details: isDevelopment ? {
              name: error.name,
              stack: error.stack
            } : void 0
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    }
  }
  if (path === "/api/auth/login" && method === "POST") {
    try {
      const body = await request.json();
      const { email, password } = body;
      const user = await queryOne(
        env,
        "SELECT id, email, password_hash, first_name, last_name, role, is_active FROM users WHERE email = ?",
        [email]
      );
      if (!user) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: "Invalid credentials" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
          ),
          env,
          request
        );
      }
      if (!user.is_active) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: "Account is deactivated" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
          ),
          env,
          request
        );
      }
      const isValid = await comparePassword(password, user.password_hash);
      if (!isValid) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: "Invalid credentials" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
          ),
          env,
          request
        );
      }
      const token = createJWT(
        { userId: user.id },
        env.JWT_SECRET,
        env.JWT_EXPIRE || "7d"
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
              role: user.role
            }
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        ),
        env,
        request
      );
    } catch (error) {
      console.error("Login error:", error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: "Server error" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    }
  }
  if (path === "/api/auth/me" && method === "GET") {
    const { authenticate: authenticate2 } = await Promise.resolve().then(() => (init_auth(), auth_exports));
    const authResult = await authenticate2(request, env);
    if (authResult.error) {
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: authResult.error }),
          {
            status: authResult.status || 401,
            headers: { "Content-Type": "application/json" }
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
          headers: { "Content-Type": "application/json" }
        }
      ),
      env,
      request
    );
  }
  return addCorsHeaders(
    new Response(
      JSON.stringify({ error: "Not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    ),
    env,
    request
  );
}
__name(handleAuth, "handleAuth");

// src/routes/jobs.js
init_db();
init_auth();
async function handleJobs(request, env, user) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  if (path === "/api/jobs" && method === "GET") {
    try {
      const { searchParams } = url;
      const status = searchParams.get("status");
      const search = searchParams.get("search");
      const location = searchParams.get("location");
      const employment_type = searchParams.get("employment_type");
      const include_deleted = searchParams.get("include_deleted");
      let sql = "SELECT * FROM jobs WHERE 1=1";
      const params = [];
      if (include_deleted !== "true") {
        sql += " AND status != 'deleted'";
      }
      if (status) {
        sql += " AND status = ?";
        params.push(status);
      }
      if (search) {
        sql += " AND (title LIKE ? OR description LIKE ? OR company LIKE ?)";
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }
      if (location) {
        sql += " AND location LIKE ?";
        params.push(`%${location}%`);
      }
      if (employment_type) {
        sql += " AND employment_type = ?";
        params.push(employment_type);
      }
      sql += " ORDER BY created_at DESC";
      const results = await query(env, sql, params);
      const jobs = results.map((job) => {
        if (job.required_skills) {
          try {
            job.required_skills = JSON.parse(job.required_skills);
          } catch (e) {
            job.required_skills = [];
          }
        }
        if (job.preferred_skills) {
          try {
            job.preferred_skills = JSON.parse(job.preferred_skills);
          } catch (e) {
            job.preferred_skills = [];
          }
        }
        return job;
      });
      return addCorsHeaders(
        new Response(
          JSON.stringify(jobs),
          { status: 200, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error("Error fetching jobs:", error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: "Server error" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    }
  }
  const singleJobMatch = path.match(/^\/api\/jobs\/(\d+)$/);
  if (singleJobMatch && method === "GET") {
    try {
      const jobId = singleJobMatch[1];
      const job = await queryOne(env, "SELECT * FROM jobs WHERE id = ?", [jobId]);
      if (!job) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: "Job not found" }),
            { status: 404, headers: { "Content-Type": "application/json" } }
          ),
          env,
          request
        );
      }
      if (job.required_skills) {
        try {
          job.required_skills = JSON.parse(job.required_skills);
        } catch (e) {
          job.required_skills = [];
        }
      }
      if (job.preferred_skills) {
        try {
          job.preferred_skills = JSON.parse(job.preferred_skills);
        } catch (e) {
          job.preferred_skills = [];
        }
      }
      return addCorsHeaders(
        new Response(
          JSON.stringify(job),
          { status: 200, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error("Error fetching job:", error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: "Server error" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    }
  }
  if (path === "/api/jobs" && method === "POST") {
    const authError = authorize("consultant", "admin")(user);
    if (authError) {
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: authError.error }),
          { status: authError.status, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    }
    try {
      const body = await request.json();
      const {
        title,
        description,
        company,
        location,
        salary_min,
        salary_max,
        employment_type,
        required_skills,
        preferred_skills,
        experience_level,
        external_apply_link,
        status
      } = body;
      const result = await execute(
        env,
        `INSERT INTO jobs (title, description, company, location, salary_min, salary_max,
         employment_type, required_skills, preferred_skills, experience_level, external_apply_link, status, posted_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          title,
          description,
          company,
          location,
          salary_min,
          salary_max,
          employment_type,
          required_skills ? JSON.stringify(required_skills) : "[]",
          preferred_skills ? JSON.stringify(preferred_skills) : "[]",
          experience_level,
          external_apply_link || null,
          status || "active",
          user.id
        ]
      );
      const jobId = result.meta.last_row_id;
      const job = await queryOne(env, "SELECT * FROM jobs WHERE id = ?", [jobId]);
      if (job.required_skills) {
        try {
          job.required_skills = JSON.parse(job.required_skills);
        } catch (e) {
          job.required_skills = [];
        }
      }
      if (job.preferred_skills) {
        try {
          job.preferred_skills = JSON.parse(job.preferred_skills);
        } catch (e) {
          job.preferred_skills = [];
        }
      }
      return addCorsHeaders(
        new Response(
          JSON.stringify(job),
          { status: 201, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error("Error creating job:", error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: "Server error" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    }
  }
  if (singleJobMatch && method === "PUT") {
    const authError = authorize("consultant", "admin")(user);
    if (authError) {
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: authError.error }),
          { status: authError.status, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    }
    try {
      const jobId = singleJobMatch[1];
      const body = await request.json();
      const {
        title,
        description,
        company,
        location,
        salary_min,
        salary_max,
        employment_type,
        required_skills,
        preferred_skills,
        experience_level,
        external_apply_link,
        status
      } = body;
      await execute(
        env,
        `UPDATE jobs SET title = ?, description = ?, company = ?, location = ?,
         salary_min = ?, salary_max = ?, employment_type = ?, required_skills = ?,
         preferred_skills = ?, experience_level = ?, external_apply_link = ?, status = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [
          title,
          description,
          company,
          location,
          salary_min,
          salary_max,
          employment_type,
          required_skills ? JSON.stringify(required_skills) : "[]",
          preferred_skills ? JSON.stringify(preferred_skills) : "[]",
          experience_level,
          external_apply_link || null,
          status,
          jobId
        ]
      );
      const job = await queryOne(env, "SELECT * FROM jobs WHERE id = ?", [jobId]);
      if (!job) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: "Job not found" }),
            { status: 404, headers: { "Content-Type": "application/json" } }
          ),
          env,
          request
        );
      }
      if (job.required_skills) {
        try {
          job.required_skills = JSON.parse(job.required_skills);
        } catch (e) {
          job.required_skills = [];
        }
      }
      if (job.preferred_skills) {
        try {
          job.preferred_skills = JSON.parse(job.preferred_skills);
        } catch (e) {
          job.preferred_skills = [];
        }
      }
      return addCorsHeaders(
        new Response(
          JSON.stringify(job),
          { status: 200, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error("Error updating job:", error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: "Server error" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    }
  }
  if (singleJobMatch && method === "DELETE") {
    const authError = authorize("consultant", "admin")(user);
    if (authError) {
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: authError.error }),
          { status: authError.status, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    }
    try {
      const jobId = singleJobMatch[1];
      await execute(
        env,
        "UPDATE jobs SET status = 'deleted', updated_at = datetime('now') WHERE id = ?",
        [jobId]
      );
      const job = await queryOne(env, "SELECT id, status FROM jobs WHERE id = ?", [jobId]);
      if (!job) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: "Job not found" }),
            { status: 404, headers: { "Content-Type": "application/json" } }
          ),
          env,
          request
        );
      }
      return addCorsHeaders(
        new Response(
          JSON.stringify({ message: "Job deleted successfully", job }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error("Error deleting job:", error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: "Server error" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    }
  }
  return addCorsHeaders(
    new Response(
      JSON.stringify({ error: "Not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    ),
    env,
    request
  );
}
__name(handleJobs, "handleJobs");

// src/routes/resumes.js
init_db();
init_auth();
async function uploadToR2(env, file, userId, originalName) {
  const timestamp = Date.now();
  const randomSuffix = Math.round(Math.random() * 1e9);
  const ext = originalName.split(".").pop();
  const key = `resumes/resume-${userId}-${timestamp}-${randomSuffix}.${ext}`;
  await env.R2_BUCKET.put(key, file, {
    httpMetadata: {
      contentType: file.type || "application/octet-stream"
    },
    customMetadata: {
      originalName,
      userId: userId.toString(),
      uploadedAt: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
  return key;
}
__name(uploadToR2, "uploadToR2");
async function getFromR2(env, key) {
  const object = await env.R2_BUCKET.get(key);
  if (!object) {
    return null;
  }
  return object;
}
__name(getFromR2, "getFromR2");
async function deleteFromR2(env, key) {
  await env.R2_BUCKET.delete(key);
}
__name(deleteFromR2, "deleteFromR2");
async function handleResumes(request, env, user) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  if (path === "/api/resumes/upload" && method === "POST") {
    try {
      const formData = await request.formData();
      const file = formData.get("resume");
      if (!file) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: "No file uploaded" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          ),
          env,
          request
        );
      }
      const allowedTypes = [".pdf", ".doc", ".docx"];
      const ext = "." + file.name.split(".").pop().toLowerCase();
      if (!allowedTypes.includes(ext)) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: "Invalid file type. Only PDF, DOC, and DOCX are allowed." }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          ),
          env,
          request
        );
      }
      if (file.size > 5 * 1024 * 1024) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: "File size exceeds 5MB limit" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          ),
          env,
          request
        );
      }
      const skills = formData.get("skills");
      const experience_years = formData.get("experience_years");
      const education = formData.get("education");
      const summary = formData.get("summary");
      const fileBuffer = await file.arrayBuffer();
      const r2Key = await uploadToR2(env, fileBuffer, user.id, file.name);
      const result = await execute(
        env,
        `INSERT INTO resumes (user_id, file_path, file_name, file_size, content_text, skills, experience_years, education, summary)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user.id,
          r2Key,
          file.name,
          file.size,
          "",
          // content_text would be extracted from file
          skills ? JSON.stringify(JSON.parse(skills)) : "[]",
          experience_years ? parseInt(experience_years) : null,
          education || "",
          summary || ""
        ]
      );
      const resumeId = result.meta.last_row_id;
      const resume = await queryOne(
        env,
        "SELECT * FROM resumes WHERE id = ?",
        [resumeId]
      );
      if (resume.skills) {
        try {
          resume.skills = JSON.parse(resume.skills);
        } catch (e) {
          resume.skills = [];
        }
      }
      return addCorsHeaders(
        new Response(
          JSON.stringify(resume),
          { status: 201, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error("Error uploading resume:", error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: "Server error" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    }
  }
  if (path === "/api/resumes/my-resumes" && method === "GET") {
    try {
      const results = await query(
        env,
        "SELECT * FROM resumes WHERE user_id = ? ORDER BY uploaded_at DESC",
        [user.id]
      );
      const resumes = results.map((resume) => {
        if (resume.skills) {
          try {
            resume.skills = JSON.parse(resume.skills);
          } catch (e) {
            resume.skills = [];
          }
        }
        return resume;
      });
      return addCorsHeaders(
        new Response(
          JSON.stringify(resumes),
          { status: 200, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error("Error fetching resumes:", error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: "Server error" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    }
  }
  if (path === "/api/resumes" && method === "GET") {
    const authError = authorize("consultant", "admin")(user);
    if (authError) {
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: authError.error }),
          { status: authError.status, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    }
    try {
      const results = await query(
        env,
        `SELECT r.*, u.first_name, u.last_name, u.email 
         FROM resumes r 
         JOIN users u ON r.user_id = u.id 
         ORDER BY r.uploaded_at DESC`
      );
      const resumes = results.map((resume) => {
        if (resume.skills) {
          try {
            resume.skills = JSON.parse(resume.skills);
          } catch (e) {
            resume.skills = [];
          }
        }
        return resume;
      });
      return addCorsHeaders(
        new Response(
          JSON.stringify(resumes),
          { status: 200, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error("Error fetching resumes:", error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: "Server error" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    }
  }
  const singleResumeMatch = path.match(/^\/api\/resumes\/(\d+)$/);
  if (singleResumeMatch && method === "GET") {
    try {
      const resumeId = singleResumeMatch[1];
      const resume = await queryOne(
        env,
        `SELECT r.*, u.first_name, u.last_name, u.email 
         FROM resumes r 
         JOIN users u ON r.user_id = u.id 
         WHERE r.id = ?`,
        [resumeId]
      );
      if (!resume) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: "Resume not found" }),
            { status: 404, headers: { "Content-Type": "application/json" } }
          ),
          env,
          request
        );
      }
      if (user.role === "candidate" && resume.user_id !== user.id) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: "Access denied" }),
            { status: 403, headers: { "Content-Type": "application/json" } }
          ),
          env,
          request
        );
      }
      if (resume.skills) {
        try {
          resume.skills = JSON.parse(resume.skills);
        } catch (e) {
          resume.skills = [];
        }
      }
      return addCorsHeaders(
        new Response(
          JSON.stringify(resume),
          { status: 200, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error("Error fetching resume:", error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: "Server error" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    }
  }
  const downloadMatch = path.match(/^\/api\/resumes\/(\d+)\/download$/);
  if (downloadMatch && method === "GET") {
    try {
      const resumeId = downloadMatch[1];
      const resume = await queryOne(
        env,
        "SELECT * FROM resumes WHERE id = ?",
        [resumeId]
      );
      if (!resume) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: "Resume not found" }),
            { status: 404, headers: { "Content-Type": "application/json" } }
          ),
          env,
          request
        );
      }
      if (user.role === "candidate" && resume.user_id !== user.id) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: "Access denied" }),
            { status: 403, headers: { "Content-Type": "application/json" } }
          ),
          env,
          request
        );
      }
      const fileObject = await getFromR2(env, resume.file_path);
      if (!fileObject) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: "File not found" }),
            { status: 404, headers: { "Content-Type": "application/json" } }
          ),
          env,
          request
        );
      }
      const fileData = await fileObject.arrayBuffer();
      const headers = new Headers();
      headers.set("Content-Type", fileObject.httpMetadata?.contentType || "application/octet-stream");
      headers.set("Content-Disposition", `attachment; filename="${resume.file_name}"`);
      return addCorsHeaders(
        new Response(fileData, {
          status: 200,
          headers
        }),
        env,
        request
      );
    } catch (error) {
      console.error("Error downloading resume:", error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: "Server error" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    }
  }
  if (singleResumeMatch && method === "PUT") {
    try {
      const resumeId = singleResumeMatch[1];
      const body = await request.json();
      const { skills, experience_years, education, summary } = body;
      const resumeCheck = await queryOne(
        env,
        "SELECT user_id FROM resumes WHERE id = ?",
        [resumeId]
      );
      if (!resumeCheck) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: "Resume not found" }),
            { status: 404, headers: { "Content-Type": "application/json" } }
          ),
          env,
          request
        );
      }
      if (resumeCheck.user_id !== user.id && user.role !== "admin") {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: "Access denied" }),
            { status: 403, headers: { "Content-Type": "application/json" } }
          ),
          env,
          request
        );
      }
      await execute(
        env,
        `UPDATE resumes SET skills = ?, experience_years = ?, education = ?, summary = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [
          skills ? JSON.stringify(skills) : "[]",
          experience_years,
          education,
          summary,
          resumeId
        ]
      );
      const updatedResume = await queryOne(
        env,
        "SELECT * FROM resumes WHERE id = ?",
        [resumeId]
      );
      if (updatedResume.skills) {
        try {
          updatedResume.skills = JSON.parse(updatedResume.skills);
        } catch (e) {
          updatedResume.skills = [];
        }
      }
      return addCorsHeaders(
        new Response(
          JSON.stringify(updatedResume),
          { status: 200, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error("Error updating resume:", error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: "Server error" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    }
  }
  if (singleResumeMatch && method === "DELETE") {
    try {
      const resumeId = singleResumeMatch[1];
      const resumeCheck = await queryOne(
        env,
        "SELECT user_id, file_path FROM resumes WHERE id = ?",
        [resumeId]
      );
      if (!resumeCheck) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: "Resume not found" }),
            { status: 404, headers: { "Content-Type": "application/json" } }
          ),
          env,
          request
        );
      }
      if (resumeCheck.user_id !== user.id && user.role !== "admin") {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: "Access denied" }),
            { status: 403, headers: { "Content-Type": "application/json" } }
          ),
          env,
          request
        );
      }
      if (resumeCheck.file_path) {
        await deleteFromR2(env, resumeCheck.file_path);
      }
      await execute(env, "DELETE FROM resumes WHERE id = ?", [resumeId]);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ message: "Resume deleted successfully" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error("Error deleting resume:", error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: "Server error" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    }
  }
  return addCorsHeaders(
    new Response(
      JSON.stringify({ error: "Not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    ),
    env,
    request
  );
}
__name(handleResumes, "handleResumes");

// src/routes/matches.js
init_db();
init_auth();
async function handleMatches(request, env, user) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  return addCorsHeaders(
    new Response(
      JSON.stringify({ error: "Matches endpoint not yet fully implemented" }),
      { status: 501, headers: { "Content-Type": "application/json" } }
    ),
    env,
    request
  );
}
__name(handleMatches, "handleMatches");

// src/routes/candidates.js
init_db();
init_auth();
async function handleCandidates(request, env, user) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  if (path === "/api/candidates/assigned" && method === "GET") {
    const authCheck = authorize("consultant", "admin")(user);
    if (authCheck) {
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: authCheck.error }),
          { status: authCheck.status || 403, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    }
    try {
      const candidates = await query(
        env,
        `SELECT 
          u.id, 
          u.first_name, 
          u.last_name, 
          u.email, 
          u.phone, 
          u.created_at,
          ca.assigned_at, 
          ca.status as assignment_status,
          (SELECT COUNT(*) FROM resumes r WHERE r.user_id = u.id) as resume_count,
          (SELECT COUNT(*) FROM job_matches jm WHERE jm.candidate_id = u.id) as match_count,
          cp.current_job_title, 
          cp.current_company, 
          cp.years_of_experience, 
          cp.availability
        FROM consultant_assignments ca
        JOIN users u ON ca.candidate_id = u.id
        LEFT JOIN candidate_profiles cp ON u.id = cp.user_id
        WHERE ca.consultant_id = ?
        ORDER BY ca.assigned_at DESC`,
        [user.id]
      );
      return addCorsHeaders(
        new Response(
          JSON.stringify(candidates),
          { status: 200, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error("Error fetching assigned candidates:", error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: "Server error" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    }
  }
  if (path === "/api/candidates" && method === "GET") {
    const authCheck = authorize("admin")(user);
    if (authCheck) {
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: authCheck.error }),
          { status: authCheck.status || 403, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    }
    try {
      const candidates = await query(
        env,
        `SELECT 
          u.id, 
          u.first_name, 
          u.last_name, 
          u.email, 
          u.phone, 
          u.role, 
          u.is_active, 
          u.created_at,
          (SELECT COUNT(*) FROM resumes r WHERE r.user_id = u.id) as resume_count,
          (SELECT COUNT(*) FROM job_matches jm WHERE jm.candidate_id = u.id) as match_count,
          cp.current_job_title, 
          cp.current_company, 
          cp.years_of_experience, 
          cp.availability
        FROM users u
        LEFT JOIN candidate_profiles cp ON u.id = cp.user_id
        WHERE u.role = 'candidate'
        ORDER BY u.created_at DESC`
      );
      return addCorsHeaders(
        new Response(
          JSON.stringify(candidates),
          { status: 200, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error("Error fetching candidates:", error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: "Server error" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    }
  }
  const candidateDetailMatch = path.match(/^\/api\/candidates\/(\d+)$/);
  if (candidateDetailMatch && method === "GET") {
    const candidateId = candidateDetailMatch[1];
    const authCheck = authorize("consultant", "admin")(user);
    if (authCheck) {
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: authCheck.error }),
          { status: authCheck.status || 403, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    }
    try {
      if (user.role === "consultant") {
        const assignmentCheck = await queryOne(
          env,
          "SELECT id FROM consultant_assignments WHERE consultant_id = ? AND candidate_id = ?",
          [user.id, candidateId]
        );
        if (!assignmentCheck) {
          return addCorsHeaders(
            new Response(
              JSON.stringify({ error: "Access denied" }),
              { status: 403, headers: { "Content-Type": "application/json" } }
            ),
            env,
            request
          );
        }
      }
      const candidate = await queryOne(
        env,
        "SELECT id, first_name, last_name, email, phone, created_at FROM users WHERE id = ? AND role = ?",
        [candidateId, "candidate"]
      );
      if (!candidate) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: "Candidate not found" }),
            { status: 404, headers: { "Content-Type": "application/json" } }
          ),
          env,
          request
        );
      }
      const resumes = await query(
        env,
        "SELECT * FROM resumes WHERE user_id = ? ORDER BY uploaded_at DESC",
        [candidateId]
      );
      const matches = await query(
        env,
        `SELECT jm.*, j.title, j.company, j.location, j.status as job_status
         FROM job_matches jm
         JOIN jobs j ON jm.job_id = j.id
         WHERE jm.candidate_id = ?
         ORDER BY jm.match_score DESC`,
        [candidateId]
      );
      const crmInteractions = await query(
        env,
        "SELECT * FROM crm_contacts WHERE candidate_id = ? ORDER BY interaction_date DESC",
        [candidateId]
      );
      const profile = await queryOne(
        env,
        "SELECT * FROM candidate_profiles WHERE user_id = ?",
        [candidateId]
      );
      return addCorsHeaders(
        new Response(
          JSON.stringify({
            ...candidate,
            resumes: resumes || [],
            matches: matches || [],
            crm_interactions: crmInteractions || [],
            profile: profile || null
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error("Error fetching candidate details:", error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: "Server error" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    }
  }
  const assignMatch = path.match(/^\/api\/candidates\/(\d+)\/assign$/);
  if (assignMatch && method === "POST") {
    const candidateId = assignMatch[1];
    const authCheck = authorize("admin")(user);
    if (authCheck) {
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: authCheck.error }),
          { status: authCheck.status || 403, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    }
    try {
      const body = await request.json();
      const { consultant_id } = body;
      const consultant = await queryOne(
        env,
        "SELECT id FROM users WHERE id = ? AND role IN (?, ?)",
        [consultant_id, "consultant", "admin"]
      );
      if (!consultant) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: "Consultant not found" }),
            { status: 404, headers: { "Content-Type": "application/json" } }
          ),
          env,
          request
        );
      }
      const existingAssignment = await queryOne(
        env,
        "SELECT id FROM consultant_assignments WHERE consultant_id = ? AND candidate_id = ?",
        [consultant_id, candidateId]
      );
      if (existingAssignment) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: "Candidate already assigned to this consultant" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          ),
          env,
          request
        );
      }
      const result = await execute(
        env,
        "INSERT INTO consultant_assignments (consultant_id, candidate_id) VALUES (?, ?)",
        [consultant_id, candidateId]
      );
      const assignment = await queryOne(
        env,
        "SELECT * FROM consultant_assignments WHERE consultant_id = ? AND candidate_id = ?",
        [consultant_id, candidateId]
      );
      return addCorsHeaders(
        new Response(
          JSON.stringify(assignment),
          { status: 201, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error("Error assigning candidate:", error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: "Server error" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    }
  }
  const unassignMatch = path.match(/^\/api\/candidates\/(\d+)\/assign\/(\d+)$/);
  if (unassignMatch && method === "DELETE") {
    const candidateId = unassignMatch[1];
    const consultantId = unassignMatch[2];
    const authCheck = authorize("admin")(user);
    if (authCheck) {
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: authCheck.error }),
          { status: authCheck.status || 403, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    }
    try {
      const assignment = await queryOne(
        env,
        "SELECT id FROM consultant_assignments WHERE consultant_id = ? AND candidate_id = ?",
        [consultantId, candidateId]
      );
      if (!assignment) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: "Assignment not found" }),
            { status: 404, headers: { "Content-Type": "application/json" } }
          ),
          env,
          request
        );
      }
      await execute(
        env,
        "DELETE FROM consultant_assignments WHERE consultant_id = ? AND candidate_id = ?",
        [consultantId, candidateId]
      );
      return addCorsHeaders(
        new Response(
          JSON.stringify({ message: "Candidate unassigned successfully" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error("Error unassigning candidate:", error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: "Server error" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    }
  }
  return addCorsHeaders(
    new Response(
      JSON.stringify({ error: "Not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    ),
    env,
    request
  );
}
__name(handleCandidates, "handleCandidates");

// src/routes/candidateProfiles.js
init_db();
init_auth();

// src/utils/activityLog.js
init_db();
async function logActivity(env, params) {
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
    let ipAddress = null;
    let userAgent = null;
    if (request) {
      ipAddress = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || request.headers.get("X-Real-IP") || null;
      userAgent = request.headers.get("User-Agent") || null;
    }
    const metadataStr = metadata ? JSON.stringify(metadata) : null;
    const truncate = /* @__PURE__ */ __name((str, maxLen = 1e3) => {
      if (!str) return null;
      const s = String(str);
      return s.length > maxLen ? s.substring(0, maxLen) + "..." : s;
    }, "truncate");
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
        truncate(description, 2e3),
        metadataStr,
        ipAddress,
        truncate(userAgent, 500)
      ]
    );
  } catch (error) {
    console.error("Error logging activity:", error);
  }
}
__name(logActivity, "logActivity");
async function logChanges(env, params) {
  const { userId, entityType, entityId, oldData, newData, request } = params;
  const changes = [];
  const allKeys = /* @__PURE__ */ new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]);
  for (const key of allKeys) {
    const oldVal = oldData?.[key];
    const newVal = newData?.[key];
    if (oldVal === newVal) continue;
    if (["id", "created_at", "updated_at"].includes(key)) continue;
    const formatValue = /* @__PURE__ */ __name((val) => {
      if (val === null || val === void 0) return null;
      if (typeof val === "object") return JSON.stringify(val);
      return String(val);
    }, "formatValue");
    changes.push({
      fieldName: key,
      oldValue: formatValue(oldVal),
      newValue: formatValue(newVal)
    });
  }
  if (changes.length === 0) {
    await logActivity(env, {
      userId,
      entityType,
      entityId,
      action: "update",
      description: `${entityType} updated (no field changes detected)`,
      request
    });
    return;
  }
  for (const change of changes) {
    await logActivity(env, {
      userId,
      entityType,
      entityId,
      action: "update",
      fieldName: change.fieldName,
      oldValue: change.oldValue,
      newValue: change.newValue,
      description: `${change.fieldName} changed from "${change.oldValue || "empty"}" to "${change.newValue || "empty"}"`,
      request
    });
  }
  await logActivity(env, {
    userId,
    entityType,
    entityId,
    action: "update",
    description: `${entityType} updated: ${changes.length} field(s) changed`,
    metadata: { changedFields: changes.map((c) => c.fieldName) },
    request
  });
}
__name(logChanges, "logChanges");

// src/routes/candidateProfiles.js
async function handleCandidateProfiles(request, env, user) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  const profileByUserIdMatch = path.match(/^\/api\/candidate-profiles\/user\/(\d+)$/);
  const profileByIdMatch = path.match(/^\/api\/candidate-profiles\/(\d+)$/);
  if ((profileByUserIdMatch || profileByIdMatch) && method === "GET") {
    const userId = profileByUserIdMatch ? profileByUserIdMatch[1] : profileByIdMatch[1];
    if (user.id !== parseInt(userId) && !["consultant", "admin"].includes(user.role)) {
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: "Access denied" }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    }
    try {
      const profile = await queryOne(
        env,
        "SELECT * FROM candidate_profiles WHERE user_id = ?",
        [userId]
      );
      if (!profile) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: "Profile not found" }),
            { status: 404, headers: { "Content-Type": "application/json" } }
          ),
          env,
          request
        );
      }
      if (profile.preferred_locations && typeof profile.preferred_locations === "string") {
        try {
          profile.preferred_locations = JSON.parse(profile.preferred_locations);
        } catch (e) {
          profile.preferred_locations = [];
        }
      }
      await logActivity(env, {
        userId: user.id,
        entityType: "candidate_profile",
        entityId: profile.id,
        action: "view",
        description: `Viewed candidate profile for user ${userId}`,
        request
      });
      return addCorsHeaders(
        new Response(
          JSON.stringify(profile),
          { status: 200, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error("Error fetching candidate profile:", error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: "Server error" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    }
  }
  if (path === "/api/candidate-profiles" && (method === "POST" || method === "PUT")) {
    try {
      const body = await request.json();
      const { user_id, ...profileData } = body;
      if (!user_id) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: "user_id is required" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          ),
          env,
          request
        );
      }
      if (user.id !== parseInt(user_id) && !["consultant", "admin"].includes(user.role)) {
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: "Access denied" }),
            { status: 403, headers: { "Content-Type": "application/json" } }
          ),
          env,
          request
        );
      }
      const existing = await queryOne(
        env,
        "SELECT * FROM candidate_profiles WHERE user_id = ?",
        [user_id]
      );
      let result;
      let oldData = null;
      if (existing) {
        oldData = { ...existing };
        const updateFields = [];
        const updateValues = [];
        const fields = [
          "date_of_birth",
          "address",
          "city",
          "state",
          "country",
          "zip_code",
          "linkedin_url",
          "portfolio_url",
          "github_url",
          "current_job_title",
          "current_company",
          "years_of_experience",
          "availability",
          "expected_salary_min",
          "expected_salary_max",
          "work_authorization",
          "willing_to_relocate",
          "preferred_locations",
          "summary",
          "additional_notes"
        ];
        for (const field of fields) {
          if (profileData.hasOwnProperty(field)) {
            updateFields.push(`${field} = ?`);
            let value = profileData[field];
            if (field === "preferred_locations" && Array.isArray(value)) {
              value = JSON.stringify(value);
            } else if (field === "willing_to_relocate") {
              value = value ? 1 : 0;
            } else if (value === "" || value === null || value === void 0) {
              value = null;
            }
            updateValues.push(value);
          }
        }
        if (updateFields.length === 0) {
          return addCorsHeaders(
            new Response(
              JSON.stringify({ error: "No fields to update" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            ),
            env,
            request
          );
        }
        updateFields.push('updated_at = datetime("now")');
        updateValues.push(user_id);
        await execute(
          env,
          `UPDATE candidate_profiles SET ${updateFields.join(", ")} WHERE user_id = ?`,
          updateValues
        );
        result = await queryOne(
          env,
          "SELECT * FROM candidate_profiles WHERE user_id = ?",
          [user_id]
        );
        await logChanges(env, {
          userId: user.id,
          entityType: "candidate_profile",
          entityId: result.id,
          oldData,
          newData: result,
          request
        });
      } else {
        const insertFields = ["user_id"];
        const insertValues = [user_id];
        const placeholders = ["?"];
        const fields = [
          "date_of_birth",
          "address",
          "city",
          "state",
          "country",
          "zip_code",
          "linkedin_url",
          "portfolio_url",
          "github_url",
          "current_job_title",
          "current_company",
          "years_of_experience",
          "availability",
          "expected_salary_min",
          "expected_salary_max",
          "work_authorization",
          "willing_to_relocate",
          "preferred_locations",
          "summary",
          "additional_notes"
        ];
        for (const field of fields) {
          insertFields.push(field);
          let value = profileData[field] || null;
          if (field === "preferred_locations" && Array.isArray(value)) {
            value = JSON.stringify(value);
          } else if (field === "willing_to_relocate") {
            value = value ? 1 : 0;
          }
          insertValues.push(value);
          placeholders.push("?");
        }
        const insertResult = await execute(
          env,
          `INSERT INTO candidate_profiles (${insertFields.join(", ")}) VALUES (${placeholders.join(", ")})`,
          insertValues
        );
        const profileId = insertResult.meta?.last_row_id || insertResult.lastInsertRowid;
        result = await queryOne(
          env,
          "SELECT * FROM candidate_profiles WHERE id = ?",
          [profileId]
        );
        await logActivity(env, {
          userId: user.id,
          entityType: "candidate_profile",
          entityId: result.id,
          action: "create",
          description: `Created candidate profile for user ${user_id}`,
          request
        });
      }
      if (result.preferred_locations && typeof result.preferred_locations === "string") {
        try {
          result.preferred_locations = JSON.parse(result.preferred_locations);
        } catch (e) {
          result.preferred_locations = [];
        }
      }
      return addCorsHeaders(
        new Response(
          JSON.stringify(result),
          { status: existing ? 200 : 201, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error("Error saving candidate profile:", error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: "Server error", message: error.message }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    }
  }
  return addCorsHeaders(
    new Response(
      JSON.stringify({ error: "Not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    ),
    env,
    request
  );
}
__name(handleCandidateProfiles, "handleCandidateProfiles");

// src/routes/timesheets.js
async function handleTimesheets(request, env, user) {
  return addCorsHeaders(
    new Response(
      JSON.stringify({ error: "Timesheets endpoint not yet fully implemented" }),
      { status: 501, headers: { "Content-Type": "application/json" } }
    ),
    env,
    request
  );
}
__name(handleTimesheets, "handleTimesheets");

// src/routes/kpis.js
async function handleKPIs(request, env, user) {
  return addCorsHeaders(
    new Response(
      JSON.stringify({ error: "KPIs endpoint not yet fully implemented" }),
      { status: 501, headers: { "Content-Type": "application/json" } }
    ),
    env,
    request
  );
}
__name(handleKPIs, "handleKPIs");

// src/routes/users.js
init_auth();
async function handleUsers(request, env, user) {
  const authError = authorize("admin")(user);
  if (authError) {
    return addCorsHeaders(
      new Response(
        JSON.stringify({ error: authError.error }),
        { status: authError.status, headers: { "Content-Type": "application/json" } }
      ),
      env,
      request
    );
  }
  return addCorsHeaders(
    new Response(
      JSON.stringify({ error: "Users endpoint not yet fully implemented" }),
      { status: 501, headers: { "Content-Type": "application/json" } }
    ),
    env,
    request
  );
}
__name(handleUsers, "handleUsers");

// src/routes/groups.js
async function handleGroups(request, env, user) {
  return addCorsHeaders(
    new Response(
      JSON.stringify({ error: "Groups endpoint not yet fully implemented" }),
      { status: 501, headers: { "Content-Type": "application/json" } }
    ),
    env,
    request
  );
}
__name(handleGroups, "handleGroups");

// src/routes/permissions.js
async function handlePermissions(request, env, user) {
  return addCorsHeaders(
    new Response(
      JSON.stringify({ error: "Permissions endpoint not yet fully implemented" }),
      { status: 501, headers: { "Content-Type": "application/json" } }
    ),
    env,
    request
  );
}
__name(handlePermissions, "handlePermissions");

// src/routes/crm.js
async function handleCRM(request, env, user) {
  return addCorsHeaders(
    new Response(
      JSON.stringify({ error: "CRM endpoint not yet fully implemented" }),
      { status: 501, headers: { "Content-Type": "application/json" } }
    ),
    env,
    request
  );
}
__name(handleCRM, "handleCRM");

// src/routes/activityLogs.js
init_db();
init_auth();
async function handleActivityLogs(request, env, user) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  if (path === "/api/activity-logs" && method === "GET") {
    const authCheck = authorize("consultant", "admin")(user);
    if (authCheck) {
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: authCheck.error }),
          { status: authCheck.status || 403, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    }
    try {
      const { searchParams } = url;
      const entityType = searchParams.get("entity_type");
      const entityId = searchParams.get("entity_id");
      const limit = parseInt(searchParams.get("limit") || "100");
      const offset = parseInt(searchParams.get("offset") || "0");
      let sql = `
        SELECT 
          al.*,
          u.first_name || ' ' || u.last_name as user_name,
          u.email as user_email
        FROM activity_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE 1=1
      `;
      const params = [];
      if (entityType) {
        sql += " AND al.entity_type = ?";
        params.push(entityType);
      }
      if (entityId) {
        sql += " AND al.entity_id = ?";
        params.push(entityId);
      }
      sql += " ORDER BY al.created_at DESC LIMIT ? OFFSET ?";
      params.push(limit, offset);
      const logs = await query(env, sql, params);
      const parsedLogs = logs.map((log) => {
        if (log.metadata && typeof log.metadata === "string") {
          try {
            log.metadata = JSON.parse(log.metadata);
          } catch (e) {
            log.metadata = null;
          }
        }
        return log;
      });
      return addCorsHeaders(
        new Response(
          JSON.stringify(parsedLogs),
          { status: 200, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    } catch (error) {
      console.error("Error fetching activity logs:", error);
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: "Server error" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        ),
        env,
        request
      );
    }
  }
  return addCorsHeaders(
    new Response(
      JSON.stringify({ error: "Not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    ),
    env,
    request
  );
}
__name(handleActivityLogs, "handleActivityLogs");

// src/router.js
init_auth();
async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  const requestOrigin = request.headers.get("Origin");
  if (method === "OPTIONS") {
    return handleCORS(env, request);
  }
  const corsHeaders = getCorsHeaders(env, requestOrigin);
  if (path === "/api" || path === "/api/") {
    return new Response(
      JSON.stringify({
        status: "OK",
        message: "API is running",
        endpoints: {
          health: "/api/health",
          register: "/api/auth/register",
          login: "/api/auth/login",
          me: "/api/auth/me"
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
  if (path === "/api/health") {
    return new Response(
      JSON.stringify({ status: "OK", message: "Server is running" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
  if (path === "/api/health/db" && method === "GET") {
    try {
      const { query: query2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const tables = await query2(env, "SELECT name FROM sqlite_master WHERE type='table'");
      const userCount = await query2(env, "SELECT COUNT(*) as count FROM users");
      return new Response(
        JSON.stringify({
          status: "OK",
          tables: tables.map((t) => t.name),
          userCount: userCount[0]?.count || 0,
          dbConnected: true
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          status: "ERROR",
          error: error.message,
          dbConnected: false
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
  }
  try {
    if (path.startsWith("/api/auth")) {
      console.log("Handling auth route:", path, method);
      try {
        const response2 = await handleAuth(request, env);
        if (response2) {
          return addCorsHeaders(response2, env, request);
        }
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: "Auth endpoint not found" }),
            { status: 404, headers: { "Content-Type": "application/json" } }
          ),
          env,
          request
        );
      } catch (authError) {
        console.error("Error in handleAuth:", authError);
        return addCorsHeaders(
          new Response(
            JSON.stringify({ error: "Auth handler error", message: authError.message }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          ),
          env,
          request
        );
      }
    }
    const authResult = await authenticate(request, env);
    if (authResult.error) {
      console.log("Authentication failed:", authResult.error, "for path:", path);
      return new Response(
        JSON.stringify({ error: authResult.error }),
        {
          status: authResult.status || 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    const user = authResult.user;
    let response;
    if (path.startsWith("/api/jobs")) {
      response = await handleJobs(request, env, user);
    } else if (path.startsWith("/api/resumes")) {
      response = await handleResumes(request, env, user);
    } else if (path.startsWith("/api/matches")) {
      response = await handleMatches(request, env, user);
    } else if (path.startsWith("/api/candidates")) {
      response = await handleCandidates(request, env, user);
    } else if (path.startsWith("/api/candidate-profiles")) {
      response = await handleCandidateProfiles(request, env, user);
    } else if (path.startsWith("/api/timesheets")) {
      response = await handleTimesheets(request, env, user);
    } else if (path.startsWith("/api/kpis")) {
      response = await handleKPIs(request, env, user);
    } else if (path.startsWith("/api/users")) {
      response = await handleUsers(request, env, user);
    } else if (path.startsWith("/api/groups")) {
      response = await handleGroups(request, env, user);
    } else if (path.startsWith("/api/permissions")) {
      response = await handlePermissions(request, env, user);
    } else if (path.startsWith("/api/crm")) {
      response = await handleCRM(request, env, user);
    } else if (path.startsWith("/api/activity-logs")) {
      response = await handleActivityLogs(request, env, user);
    } else {
      response = new Response(
        JSON.stringify({ error: "Not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    return addCorsHeaders(response, env, request);
  } catch (error) {
    console.error("Route handler error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", message: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
}
__name(handleRequest, "handleRequest");

// worker.js
var worker_default = {
  async fetch(request, env, ctx) {
    try {
      return await handleRequest(request, env, ctx);
    } catch (error) {
      console.error("Unhandled error:", error);
      return new Response(
        JSON.stringify({ error: "Internal server error", message: error.message }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
