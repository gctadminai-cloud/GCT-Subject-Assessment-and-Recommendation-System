import { describe, it, expect } from 'vitest';
import app from '../server.js';

// Helper to simulate request to express app using node http server
function testRequest(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      const http = require('http');
      const payload = body ? JSON.stringify(body) : null;
      
      const req = http.request({
        hostname: 'localhost',
        port: port,
        path: path,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...headers
        }
      }, (res) => {
        let resBody = '';
        res.on('data', chunk => resBody += chunk);
        res.on('end', () => {
          server.close();
          try {
            resolve({ status: res.statusCode, data: JSON.parse(resBody || '{}') });
          } catch {
            resolve({ status: res.statusCode, text: resBody });
          }
        });
      });

      req.on('error', (err) => {
        server.close();
        reject(err);
      });

      if (payload) req.write(payload);
      req.end();
    });
  });
}

describe('Role-Based Access Control (RBAC) Integration', () => {
  const adminHeaders = {
    'x-user-id': 'demo-admin-id',
    'x-user-role': 'registrar_admin',
    'x-user-name': 'System Administrator'
  };

  const staffHeaders = {
    'x-user-id': 'demo-staff-id',
    'x-user-role': 'registrar_staff',
    'x-user-name': 'Maria Santos'
  };

  const studentHeaders = {
    'x-user-id': 'demo-student-id',
    'x-user-role': 'student',
    'x-user-name': 'Student User',
    'x-user-status': 'approved'
  };

  describe('Staff Accounts & User Management (/api/staff-accounts)', () => {
    it('allows registrar_admin to view staff accounts', async () => {
      const res = await testRequest('GET', '/api/staff-accounts', adminHeaders);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
    });

    it('blocks registrar_staff from staff account management with 403', async () => {
      const res = await testRequest('GET', '/api/staff-accounts', staffHeaders);
      expect(res.status).toBe(403);
    });

    it('blocks student from staff account management with 403', async () => {
      const res = await testRequest('GET', '/api/staff-accounts', studentHeaders);
      expect(res.status).toBe(403);
    });
  });

  describe('Curriculum Management (/api/curriculum)', () => {
    it('allows registrar_admin to add a subject', async () => {
      const uniqueCode = 'TEST-' + Math.floor(Math.random() * 1000000);
      const res = await testRequest('POST', '/api/curriculum/subjects', adminHeaders, {
        code: uniqueCode,
        title: 'Introduction to Testing',
        units: 3,
        program: 'BSIT',
        year_level: 1,
        semester: '1st Semester'
      });
      expect(res.status).toBe(201);
      const { supabase } = await import('../config/supabase.js');
      await supabase.from('subjects').delete().eq('code', uniqueCode);
    });

    it('blocks registrar_staff from adding a curriculum subject with 403', async () => {
      const res = await testRequest('POST', '/api/curriculum/subjects', staffHeaders, {
        code: 'TEST-DENIED',
        title: 'Advanced Testing',
        units: 3,
        program: 'BSIT',
        year_level: 1,
        semester: '1st Semester'
      });
      expect(res.status).toBe(403);
    });
  });

  describe('System Settings & Policies (/api/settings)', () => {
    it('allows registrar_admin to update settings via PUT', async () => {
      const res = await testRequest('PUT', '/api/settings', adminHeaders, {
        key: 'passing_grade_threshold',
        value: '75'
      });
      expect(res.status).toBe(200);
    });

    it('blocks registrar_staff from updating settings with 403', async () => {
      const res = await testRequest('PUT', '/api/settings', staffHeaders, {
        key: 'passing_grade_threshold',
        value: '75'
      });
      expect(res.status).toBe(403);
    });
  });

  describe('Reports & Analytics (/api/reports)', () => {
    it('allows registrar_admin to access report summary', async () => {
      const res = await testRequest('GET', '/api/reports/academic-progress', adminHeaders);
      expect(res.status).toBe(200);
    });

    it('blocks registrar_staff from accessing report summary with 403', async () => {
      const res = await testRequest('GET', '/api/reports/academic-progress', staffHeaders);
      expect(res.status).toBe(403);
    });
  });

  describe('Shared Registrar Access (/api/students & /api/academic-records)', () => {
    it('allows both registrar_admin and registrar_staff to view students', async () => {
      const adminRes = await testRequest('GET', '/api/students', adminHeaders);
      expect(adminRes.status).toBe(200);

      const staffRes = await testRequest('GET', '/api/students', staffHeaders);
      expect(staffRes.status).toBe(200);
    });

    it('allows both registrar_admin and registrar_staff to view academic records', async () => {
      const adminRes = await testRequest('GET', '/api/academic-records?academic_year=2026-2027', adminHeaders);
      expect(adminRes.status).toBe(200);

      const staffRes = await testRequest('GET', '/api/academic-records?academic_year=2026-2027', staffHeaders);
      expect(staffRes.status).toBe(200);
    }, 15000);
  });
});
