const jwt = require('jsonwebtoken');
const { supabase } = require('../config/supabase');

const DEVELOPMENT_JWT_SECRET = 'gct-capstone-jwt-secret-key-production-2026';
const LEGACY_JWT_SECRET = DEVELOPMENT_JWT_SECRET;

function resolveJwtSecret(env = process.env) {
  const secret = typeof env.JWT_SECRET === 'string' ? env.JWT_SECRET.trim() : '';
  const isLocalEnvironment = env.NODE_ENV === 'development' || env.NODE_ENV === 'test';
  if (!isLocalEnvironment && (secret.length < 32 || secret === LEGACY_JWT_SECRET)) {
    throw new Error('Set a unique JWT_SECRET of at least 32 characters before starting outside development/test.');
  }
  return secret || DEVELOPMENT_JWT_SECRET;
}

const JWT_SECRET = resolveJwtSecret();

function isDevelopmentBypassEnabled() {
  return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
}

/**
 * Middleware to verify JWT authentication token & attach account/profile info.
 */
async function authenticate(req, res, next) {
  try {
    // Developer identity headers are only trusted outside production.
    if (isDevelopmentBypassEnabled() && req.headers['x-user-id'] && req.headers['x-user-role']) {
      const isStud = req.headers['x-user-role'] === 'student';
      const studId = req.headers['x-student-id'] || (isStud ? req.headers['x-user-id'] : null);
      req.user = {
        id: req.headers['x-user-id'],
        student_id: studId,
        username: studId || req.headers['x-user-name'] || 'dev_user',
        email: req.headers['x-user-email'] || 'dev@gct.edu.ph',
        role: req.headers['x-user-role'],
        full_name: req.headers['x-user-name'] || 'Dev User',
        approval_status: req.headers['x-user-status'] || 'approved',
        status: req.headers['x-user-status'] || 'approved'
      };
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Allow direct browser inspection in development mode
      if (isDevelopmentBypassEnabled()) {
        req.user = {
          id: 'dev-admin',
          student_id: null,
          username: 'admin',
          email: 'admin@gct.edu.ph',
          role: 'registrar_admin',
          full_name: 'System Administrator',
          approval_status: 'approved',
          status: 'approved'
        };
        return next();
      }
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.split(' ')[1];

    // 2. Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtErr) {
      // Also support legacy Supabase auth tokens if passed
      if (supabase) {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (!error && user) {
          decoded = {
            id: user.id,
            role: user.user_metadata?.role || 'student',
            email: user.email
          };
        }
      }
      if (!decoded) {
        return res.status(401).json({ error: 'Invalid or expired token', details: jwtErr.message });
      }
    }

    // 3. Retrieve account details from Supabase accounts table
    let account = null;
    const lookupTerms = [decoded.id, decoded.username, decoded.student_id].filter(Boolean);
    if (lookupTerms.length > 0) {
      const isUuid = (val) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
      const parts = [];
      for (const term of lookupTerms) {
        parts.push(`username.eq.${term}`);
        parts.push(`student_id.eq.${term}`);
        if (isUuid(term)) {
          parts.push(`id.eq.${term}`);
        }
      }

      if (parts.length > 0) {
        try {
          const { data: accounts } = await supabase
            .from('accounts')
            .select('*')
            .or(parts.join(','))
            .limit(1);

          account = accounts?.[0] || null;
        } catch (err) {
          // Ignore table lookup error
        }
      }
    }

    // Attach user payload
    req.user = {
      id: decoded.id || account?.id,
      student_id: decoded.student_id || account?.student_id || null,
      username: decoded.username || account?.username,
      role: decoded.role || account?.role || 'student',
      status: account?.status || 'approved',
      approval_status: account?.status || 'approved',
      full_name: decoded.full_name || account?.username || 'User'
    };

    next();
  } catch (error) {
    console.error('Authentication Middleware Error:', error);
    res.status(500).json({ error: 'Internal Server Authentication Error' });
  }
}

/**
 * Optional authentication middleware:
 * Attaches user profile if credentials provided; otherwise falls back to guest user.
 */
async function optionalAuthenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    // Developer identity headers are only trusted outside production.
    if (isDevelopmentBypassEnabled() && req.headers['x-user-id'] && req.headers['x-user-role']) {
      req.user = {
        id: req.headers['x-user-id'],
        student_id: req.headers['x-student-id'] || null,
        username: req.headers['x-user-name'] || 'dev_user',
        email: req.headers['x-user-email'] || 'dev@gct.edu.ph',
        role: req.headers['x-user-role'],
        full_name: req.headers['x-user-name'] || 'Dev User',
        approval_status: req.headers['x-user-status'] || 'approved',
        status: req.headers['x-user-status'] || 'approved'
      };
      return next();
    }

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded) {
          req.user = {
            id: decoded.id,
            student_id: decoded.student_id || null,
            username: decoded.username,
            role: decoded.role || 'student',
            status: 'approved',
            approval_status: 'approved',
            full_name: decoded.full_name || decoded.username || 'User'
          };
          return next();
        }
      } catch (e) {}
    }

    // Default guest for public / unauthenticated access (e.g. login chatbot)
    req.user = {
      id: 'guest',
      username: 'guest',
      email: 'guest@gct.edu.ph',
      role: 'guest',
      full_name: 'Visitor',
      approval_status: 'approved',
      status: 'approved'
    };
    next();
  } catch (error) {
    req.user = {
      id: 'guest',
      username: 'guest',
      email: 'guest@gct.edu.ph',
      role: 'guest',
      full_name: 'Visitor',
      approval_status: 'approved',
      status: 'approved'
    };
    next();
  }
}

/**
 * RBAC Gating Middleware: restrict endpoint to specified roles.
 * Role decisions are based STRICTLY on the account's verified role, never username formatting.
 * Role hierarchy:
 * - registrar_admin has full access to all registrar_staff and registrar_admin endpoints.
 * - registrar_staff can access registrar_staff allowed endpoints.
 * - student can access student allowed endpoints ONLY if status === 'approved'.
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }

    const userRole = req.user.role;
    const hasRole = allowedRoles.includes(userRole) || (userRole === 'registrar_admin' && allowedRoles.includes('registrar_staff'));

    if (!hasRole) {
      return res.status(403).json({ error: `Forbidden: Access restricted to roles [${allowedRoles.join(', ')}]` });
    }

    // Students must have approved status to access protected routes
    if (req.user.role === 'student' && req.user.status !== 'approved') {
      return res.status(403).json({ error: 'Account pending registrar approval' });
    }

    next();
  };
}

module.exports = {
  authenticate,
  optionalAuthenticate,
  requireRole,
  JWT_SECRET,
  resolveJwtSecret
};
