const bcrypt = require('bcryptjs');
const { supabase } = require('../config/supabase');

async function getStaffAccounts(req, res) {
  try {
    const { data: staffAccounts, error: aErr } = await supabase
      .from('accounts')
      .select('*')
      .or('role.eq.registrar_staff,role.eq.registrar_admin')
      .order('created_at', { ascending: false });

    const { data: staffProfiles } = await supabase
      .from('profiles')
      .select('*')
      .or('role.eq.registrar_staff,role.eq.registrar_admin');

    const profileMap = new Map();
    (staffProfiles || []).forEach(p => {
      if (p.id) profileMap.set(p.id, p);
      if (p.email) profileMap.set(p.email.toLowerCase(), p);
    });

    const combined = (staffAccounts || []).map(a => {
      const email = a.username.includes('@') ? a.username : `${a.username}@gct.edu.ph`;
      const prof = profileMap.get(a.id) || profileMap.get(email.toLowerCase());
      return {
        id: a.id,
        username: a.username,
        email: prof?.email || email,
        name: prof?.full_name || (a.role === 'registrar_admin' ? 'System Administrator' : a.username),
        role: a.role,
        status: a.status === 'approved' || a.status === 'active' ? 'active' : 'inactive',
        created_at: a.created_at
      };
    });

    res.json(combined);
  } catch (error) {
    console.error('Get Staff Accounts Error:', error);
    res.status(500).json({ error: error.message });
  }
}

async function createStaffAccount(req, res) {
  try {
    const { username, password, email, full_name, name, role } = req.body;
    const staffName = (full_name || name || '').trim();

    if (!staffName) {
      return res.status(400).json({ error: 'Full name is required' });
    }

    const cleanUsername = (username || (email ? email.split('@')[0] : '')).trim().toLowerCase();
    if (!cleanUsername) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const rawPassword = (password || '').trim();
    if (!rawPassword) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const staffEmail = (email || `${cleanUsername}@gct.edu.ph`).trim().toLowerCase();
    const assignedRole = (role === 'registrar_admin') ? 'registrar_admin' : 'registrar_staff';

    // 1. Check if username already exists in accounts table
    const { data: existingAccounts } = await supabase
      .from('accounts')
      .select('id, username')
      .or(`username.ilike.${cleanUsername},student_id.ilike.${cleanUsername}`)
      .limit(1);

    if (existingAccounts && existingAccounts.length > 0) {
      return res.status(400).json({
        error: `Username '${cleanUsername}' is already taken. Please choose a different username.`
      });
    }

    const password_hash = await bcrypt.hash(rawPassword, 10);
    const staffId = require('crypto').randomUUID();
    const now = new Date().toISOString();

    // 2. Insert into accounts table
    const { error: accErr } = await supabase
      .from('accounts')
      .upsert([{
        id: staffId,
        username: cleanUsername,
        password_hash: password_hash,
        role: assignedRole,
        status: 'approved',
        created_at: now
      }], { onConflict: 'username' });

    if (accErr) throw accErr;

    // 3. Insert into profiles table with matching ID and email
    await supabase
      .from('profiles')
      .upsert([{
        id: staffId,
        email: staffEmail,
        role: assignedRole,
        full_name: staffName,
        approval_status: 'approved',
        created_at: now
      }], { onConflict: 'email' });

    res.status(201).json({
      message: 'New Registrar staff account provisioned successfully!',
      account: {
        id: staffId,
        username: cleanUsername,
        email: staffEmail,
        name: staffName,
        role: assignedRole,
        status: 'active'
      }
    });
  } catch (error) {
    console.error('Create Staff Account Error:', error);
    res.status(500).json({ error: error.message });
  }
}

async function updateStaffStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'active' or 'inactive'

    // Prevent deactivating the System Administrator account
    const { data: acc } = await supabase
      .from('accounts')
      .select('id, username, role')
      .or(`id.eq.${id},username.eq.${id}`)
      .limit(1);

    const accountRow = acc?.[0];
    if (accountRow && (accountRow.role === 'registrar_admin' || accountRow.username === 'admin') && status === 'inactive') {
      return res.status(400).json({ error: 'System Administrator account cannot be deactivated.' });
    }

    const dbStatus = (status === 'active' || status === 'approved') ? 'approved' : 'inactive';

    await supabase
      .from('accounts')
      .update({ status: dbStatus })
      .or(`id.eq.${id},username.eq.${id}`);

    res.json({ message: `Staff status updated to ${status}` });
  } catch (error) {
    console.error('Update Staff Status Error:', error);
    res.status(500).json({ error: error.message });
  }
}

async function deleteStaffAccount(req, res) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Staff ID is required for deletion.' });
    }

    const lowerId = String(id).toLowerCase().trim();
    if (lowerId === 'admin' || lowerId === 'registrar_admin') {
      return res.status(400).json({ error: 'System Administrator account cannot be deleted.' });
    }

    const { data: acc } = await supabase
      .from('accounts')
      .select('*')
      .or(`id.eq.${id},username.eq.${id}`)
      .limit(1);

    const accountRow = acc?.[0];
    if (accountRow && (accountRow.role === 'registrar_admin' || accountRow.username === 'admin' || accountRow.username === 'registrar_admin')) {
      return res.status(400).json({ error: 'System Administrator account cannot be deleted.' });
    }

    if (accountRow) {
      const email = accountRow.username.includes('@') ? accountRow.username : `${accountRow.username}@gct.edu.ph`;
      // Delete associated profile by id or email
      await supabase
        .from('profiles')
        .delete()
        .or(`id.eq.${accountRow.id},id.eq.${id},email.eq.${email},email.ilike.${accountRow.username}@%`);

      // Delete from accounts
      await supabase
        .from('accounts')
        .delete()
        .or(`id.eq.${id},username.eq.${id},id.eq.${accountRow.id}`);
    } else {
      await supabase.from('accounts').delete().or(`id.eq.${id},username.eq.${id}`);
      await supabase.from('profiles').delete().or(`id.eq.${id},email.ilike.${id}@%`);
    }

    res.json({ message: 'Staff account deleted successfully from Supabase' });
  } catch (error) {
    console.error('Delete Staff Error:', error);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  getStaffAccounts,
  createStaffAccount,
  updateStaffStatus,
  deleteStaffAccount
};
