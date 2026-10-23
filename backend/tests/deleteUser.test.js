import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../server.js';
import { supabase } from '../config/supabase';
import http from 'http';

function testRequest(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
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

describe('User Management Deletion & Supabase Sync', () => {
  const adminHeaders = {
    'x-user-id': 'demo-admin-id',
    'x-user-role': 'registrar_admin',
    'x-user-name': 'System Administrator'
  };

  const testStaffId = 'staff-delete-test-' + Date.now();
  const testStaffUsername = 'teststaffdel_' + Date.now().toString().slice(-4);
  const testStaffEmail = `${testStaffUsername}@gct.edu.ph`;

  const testStudentId = 'GCT-DEL-' + Date.now().toString().slice(-4);
  const testStudentEmail = `${testStudentId.toLowerCase()}@student.gct.edu.ph`;

  beforeAll(async () => {
    // Insert test staff in Supabase
    await supabase.from('accounts').insert([{
      id: testStaffId,
      username: testStaffUsername,
      password_hash: 'testhash',
      role: 'registrar_staff',
      status: 'approved'
    }]);

    await supabase.from('profiles').insert([{
      id: testStaffId,
      email: testStaffEmail,
      full_name: 'Test Staff For Deletion',
      role: 'registrar_staff',
      approval_status: 'approved'
    }]);

    // Insert test student in Supabase (unverified/pending, no grade records)
    await supabase.from('students').insert([{
      id: `s-${testStudentId}`,
      student_id: testStudentId,
      full_name: 'Test Student For Deletion',
      email: testStudentEmail,
      program: 'BSIT',
      year_level: 1,
      verified: false
    }]);

    await supabase.from('accounts').insert([{
      id: `acc-${testStudentId}`,
      student_id: testStudentId,
      username: testStudentId,
      password_hash: 'testhash',
      role: 'student',
      status: 'pending'
    }]);

    await supabase.from('profiles').insert([{
      id: `acc-${testStudentId}`,
      email: testStudentEmail,
      full_name: 'Test Student For Deletion',
      role: 'student',
      approval_status: 'pending'
    }]);
  });

  afterAll(async () => {
    // Cleanup if any remains
    await supabase.from('accounts').delete().or(`id.eq.${testStaffId},username.eq.${testStaffUsername},student_id.eq.${testStudentId}`);
    await supabase.from('profiles').delete().or(`id.eq.${testStaffId},email.eq.${testStaffEmail},email.eq.${testStudentEmail}`);
    await supabase.from('students').delete().eq('student_id', testStudentId);
  });

  it('should delete staff account and remove from Supabase accounts and profiles', async () => {
    const res = await testRequest('DELETE', `/api/staff/${testStaffId}`, adminHeaders);

    expect(res.status).toBe(200);
    expect(res.data.message).toContain('deleted successfully');

    // Verify account is deleted in Supabase
    const { data: accData } = await supabase
      .from('accounts')
      .select('id')
      .eq('id', testStaffId);
    expect(accData?.length).toBe(0);

    // Verify profile is deleted in Supabase
    const { data: profData } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', testStaffEmail);
    expect(profData?.length).toBe(0);
  });

  it('should protect system admin from deletion', async () => {
    const res = await testRequest('DELETE', '/api/staff/admin', adminHeaders);

    expect(res.status).toBe(400);
    expect(res.data.error).toContain('System Administrator account cannot be deleted');
  });

  it('should delete student account and clean up Supabase tables', async () => {
    const res = await testRequest('DELETE', `/api/students/${testStudentId}`, adminHeaders);

    expect(res.status).toBe(200);
    expect(res.data.message).toContain('deleted successfully');

    // Verify account is deleted in Supabase
    const { data: accData } = await supabase
      .from('accounts')
      .select('id')
      .eq('student_id', testStudentId);
    expect(accData?.length).toBe(0);

    // Verify student is deleted in Supabase students table (since no grade records exist)
    const { data: studentData } = await supabase
      .from('students')
      .select('id')
      .eq('student_id', testStudentId);
    expect(studentData?.length).toBe(0);
  });
});
