import { afterEach, describe, expect, it } from 'vitest';
import authMiddleware from '../middleware/authMiddleware.js';

const { authenticate, optionalAuthenticate, resolveJwtSecret } = authMiddleware;
const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
});

describe('developer auth-header bypass', () => {
  const headers = {
    'x-user-id': 'forged-admin',
    'x-user-role': 'registrar_admin'
  };

  it('rejects identity headers without a JWT in production', async () => {
    process.env.NODE_ENV = 'production';
    let statusCode;
    let responseBody;
    let nextCalled = false;
    const response = {
      status(code) { statusCode = code; return this; },
      json(body) { responseBody = body; return this; }
    };

    await authenticate({ headers }, response, () => { nextCalled = true; });

    expect(statusCode).toBe(401);
    expect(responseBody.error).toContain('Authorization');
    expect(nextCalled).toBe(false);
  });

  it('treats identity headers as guest context in production optional auth', async () => {
    process.env.NODE_ENV = 'production';
    const request = { headers };
    let nextCalled = false;

    await optionalAuthenticate(request, {}, () => { nextCalled = true; });

    expect(nextCalled).toBe(true);
    expect(request.user.role).toBe('guest');
    expect(request.user.id).toBe('guest');
  });

  it('does not grant the fallback admin identity in staging', async () => {
    process.env.NODE_ENV = 'staging';
    let statusCode;
    let nextCalled = false;
    const response = {
      status(code) { statusCode = code; return this; },
      json() { return this; }
    };

    await authenticate({ headers: {} }, response, () => { nextCalled = true; });

    expect(statusCode).toBe(401);
    expect(nextCalled).toBe(false);
  });

  it('retains the developer bypass outside production', async () => {
    process.env.NODE_ENV = 'test';
    const request = { headers };
    let nextCalled = false;

    await authenticate(request, {}, () => { nextCalled = true; });

    expect(nextCalled).toBe(true);
    expect(request.user.role).toBe('registrar_admin');
    expect(request.user.id).toBe('forged-admin');
  });
});

describe('JWT secret configuration', () => {
  it('requires a unique 32-character secret outside development and test', () => {
    expect(() => resolveJwtSecret({ NODE_ENV: 'production' })).toThrow('JWT_SECRET');
    expect(() => resolveJwtSecret({ NODE_ENV: 'staging', JWT_SECRET: 'short-secret' })).toThrow('JWT_SECRET');
    expect(() => resolveJwtSecret({
      NODE_ENV: 'production',
      JWT_SECRET: 'gct-capstone-jwt-secret-key-production-2026'
    })).toThrow('JWT_SECRET');
  });

  it('accepts a configured production secret and keeps the local fallback for tests', () => {
    const productionSecret = 'a'.repeat(32);
    expect(resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: productionSecret })).toBe(productionSecret);
    expect(resolveJwtSecret({ NODE_ENV: 'test' })).toBe('gct-capstone-jwt-secret-key-production-2026');
  });
});