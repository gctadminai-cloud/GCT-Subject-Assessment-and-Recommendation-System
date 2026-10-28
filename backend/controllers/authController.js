const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase } = require('../config/supabase');
const { JWT_SECRET } = require('../middleware/authMiddleware');
const { sendPasswordResetOtp, sendRegistrationOtp } = require('../services/emailService');

// In-memory store for 6-digit email OTPs (Key: lowercase email, Value: { otp, expiresAt, recipientName, targetEmail, username })
const otpStore = new Map();

// In-memory store for 6-digit registration OTPs (Key: email or student_id)
const registrationOtpStore = new Map();

/**
 * Single Unified Login for ALL roles (Student, Registrar Staff, Registrar Admin).
 * Username:
 *   - Student: GCT Student ID (e.g., "GCT-2026-0123")
 *   - Registrar: "registrar_admin" or "registrar_staff"
 * POST /api/login and /api/auth/login
 */
async function loginUser(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const cleanUsername = username.trim();
    const lowerUser = cleanUsername.toLowerCase();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanUsername);

    // Extract handle without email domain if provided (e.g. "10526@student.gct.edu.ph" -> "10526")
    const handleWithoutDomain = cleanUsername.includes('@') ? cleanUsername.split('@')[0] : cleanUsername;

    let account = null;
    let legacyPassword = null;

    // 1. Look up in Supabase accounts table with flexible handles
    try {
      const searchHandles = [cleanUsername, handleWithoutDomain];
      if (lowerUser === 'admin' || lowerUser.startsWith('admin@')) searchHandles.push('registrar_admin');
      if (lowerUser === 'registrar_admin') searchHandles.push('admin');
      searchHandles.push(`${handleWithoutDomain}@student.gct.edu.ph`);
      searchHandles.push(`${handleWithoutDomain}@gct.edu.ph`);

      // Cross-resolve student ID <-> email from students table
      try {
        const { data: matchedStudents } = await supabase
          .from('students')
          .select('student_id, email, id')
          .or(`student_id.eq.${cleanUsername},student_id.eq.${handleWithoutDomain},email.ilike.${cleanUsername},email.ilike.${handleWithoutDomain}@%`)
          .limit(1);

        if (matchedStudents && matchedStudents.length > 0) {
          const st = matchedStudents[0];
          if (st.student_id) {
            searchHandles.push(st.student_id);
            searchHandles.push(`GCT-${st.student_id}`);
          }
          if (st.email) {
            searchHandles.push(st.email);
            searchHandles.push(st.email.split('@')[0]);
          }
        }
      } catch (stMatchErr) {}

      const accOrParts = [];
      for (const handle of searchHandles) {
        accOrParts.push(`username.ilike.${handle}`);
        accOrParts.push(`student_id.ilike.${handle}`);
        if (isUuid) {
          accOrParts.push(`id.eq.${handle}`);
        }
      }

      const { data: accounts, error: accErr } = await supabase
        .from('accounts')
        .select('*')
        .or(accOrParts.join(','))
        .limit(1);

      if (!accErr && accounts && accounts.length > 0) {
        account = accounts[0];
      }
    } catch (err) {
      console.warn('Supabase accounts lookup notice:', err.message);
    }

    // 2. Fallback lookup in profiles table
    if (!account) {
      try {
        const isOfficialAdmin = lowerUser === 'registrar_admin' || lowerUser === 'admin' || lowerUser === 'gctadmin.ai@gmail.com';
        const emailQuery = cleanUsername.includes('@')
          ? cleanUsername
          : (isOfficialAdmin
            ? 'gctadmin.ai@gmail.com'
            : `${handleWithoutDomain}@student.gct.edu.ph`);

        const profOrParts = [`email.ilike.${cleanUsername}`, `email.ilike.${emailQuery}`];
        if (isUuid) {
          profOrParts.push(`id.eq.${cleanUsername}`);
        }

        const { data: profiles, error: profErr } = await supabase
          .from('profiles')
          .select('*')
          .or(profOrParts.join(','))
          .limit(1);

        const legacyProfile = profiles?.[0];
        if (!profErr && legacyProfile) {
          account = {
            id: legacyProfile.id,
            student_id: legacyProfile.role === 'student' ? handleWithoutDomain : null,
            username: legacyProfile.role === 'registrar_admin' ? 'admin' : handleWithoutDomain,
            password_hash: legacyProfile.password_hash || null,
            role: legacyProfile.role,
            status: legacyProfile.approval_status || 'approved'
          };
        }
      } catch (err) {
        console.warn('Supabase profiles lookup notice:', err.message);
      }
    }

    if (!account) {
      return res.status(401).json({
        error: `No account found for '${cleanUsername}'. If you are a student, please register your account first.`
      });
    }

    // 5. Verify password strictly with bcrypt or legacy excel password (no hardcoded passwords)
    let passwordMatch = false;
    if (account.password_hash) {
      passwordMatch = await bcrypt.compare(password, account.password_hash);
    }
    if (!passwordMatch && legacyPassword) {
      passwordMatch = (password === legacyPassword);
    }

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid password. Please check your credentials.' });
    }

    // 5. For students, enforce status === 'approved'
    if (account.role === 'student') {
      if (account.status === 'pending') {
        return res.status(403).json({
          error: 'Your student account is currently pending verification and approval by Registrar Staff. Please check back later.'
        });
      }
      if (account.status === 'rejected') {
        return res.status(403).json({
          error: 'Your student registration was rejected by the Registrar. Please visit the Registrar’s Office for assistance.'
        });
      }
    }

    // 6. Retrieve student record or staff info
    let studentRecord = null;
    let fullName = account.role === 'registrar_admin' ? 'System Administrator' : account.username;
    let staffEmail = account.role === 'registrar_admin' ? 'gctadmin.ai@gmail.com' : '';
    if (account.student_id || account.role === 'student') {
      const rawSId = String(account.student_id || account.username || '').trim();
      const bareSId = rawSId.replace(/^(s-|student-|acc-|gct-)/i, '').trim();
      const lookupIds = Array.from(new Set([rawSId, bareSId, `GCT-${bareSId}`].filter(Boolean)));
      const orClauses = [];
      lookupIds.forEach(val => {
        orClauses.push(`student_id.eq.${val}`);
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) {
          orClauses.push(`id.eq.${val}`);
        }
      });
      const studentFilter = orClauses.length > 0 ? orClauses.join(',') : `student_id.eq.${rawSId}`;

      const { data: students } = await supabase
        .from('students')
        .select('*')
        .or(studentFilter)
        .limit(1);

      studentRecord = students?.[0] || null;
      if (studentRecord) {
        fullName = studentRecord.full_name || studentRecord.student_id;
      } else {
        try {
          const { data: gData } = await supabase
            .from('grade_records')
            .select('full_name, course, year_level')
            .in('student_id', lookupIds)
            .limit(1);
          if (gData && gData[0]) {
            fullName = gData[0].full_name || fullName;
            studentRecord = {
              student_id: bareSId,
              full_name: gData[0].full_name,
              program: gData[0].course || 'BSIT',
              year_level: gData[0].year_level || 1
            };
          }
        } catch (e) { }
      }
    } else {
      // Staff / Admin full name & email from profiles
      try {
        const emailToMatch = account.username.includes('@')
          ? account.username
          : `${account.username}@gct.edu.ph`;

        const profFilters = [];
        if (account.id) profFilters.push(`id.eq.${account.id}`);
        profFilters.push(`email.ilike.${account.username}`);
        profFilters.push(`email.ilike.${emailToMatch}`);
        if (account.role === 'registrar_admin') {
          profFilters.push(`email.eq.gctadmin.ai@gmail.com`);
        }

        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .or(profFilters.join(','))
          .limit(1);

        const staffProf = profiles?.[0];
        if (staffProf?.full_name) fullName = staffProf.full_name;
        if (staffProf?.email) staffEmail = staffProf.email;
      } catch (e) { }
    }

    // 7. Issue JWT Token (1 hour expiry)
    const tokenPayload = {
      id: account.id,
      student_id: account.student_id || (account.role === 'student' ? account.username : null),
      username: account.username,
      role: account.role,
      status: account.status,
      full_name: fullName
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1h' });

    // Response user object
    const userResponse = {
      id: account.id,
      student_id: tokenPayload.student_id,
      username: account.username,
      role: account.role,
      status: account.status,
      approval_status: account.status,
      full_name: fullName,
      email: studentRecord?.email || staffEmail || account.email || (account.role === 'registrar_admin' ? 'gctadmin.ai@gmail.com' : ''),
      program: studentRecord?.program || 'BSIT',
      year_level: studentRecord?.year_level || 1,
      schedule: studentRecord?.schedule || studentRecord?.section || 'Default'
    };

    res.json({
      message: 'Login successful',
      token,
      user: userResponse
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ error: error.message || 'Login failed' });
  }
}

/**
 * Check if Student ID is First-Time or Returning, and lookup existing record
 * from students table AND grade_records table so existing student data
 * (Full Name, Course/Program, Year Level) can be pre-filled / based upon.
 * GET /api/auth/check-student/:studentId
 */
async function checkStudentStatus(req, res) {
  try {
    const { studentId } = req.params;
    if (!studentId) {
      return res.status(400).json({ error: 'Student ID is required' });
    }

    const cleanId = studentId.trim();
    const bareId = cleanId.replace(/^GCT-/i, '').trim();
    const withGct = cleanId.startsWith('GCT-') ? cleanId : `GCT-${bareId}`;
    const idVariants = Array.from(new Set([cleanId, bareId, withGct])).filter(Boolean);

    // 1. Check if student exists in permanent students table
    const { data: students } = await supabase
      .from('students')
      .select('*')
      .in('student_id', idVariants)
      .limit(1);

    const student = students?.[0] || null;

    // 2. Query grade_records table to see if student has existing academic history
    let gradeRow = null;
    try {
      const { data: grades } = await supabase
        .from('grade_records')
        .select('student_id, full_name, last_name, first_name, course, year_level')
        .in('student_id', idVariants)
        .order('year_level', { ascending: false })
        .limit(1);
      
      if (grades && grades.length > 0) {
        gradeRow = grades[0];
      }
    } catch (gErr) {
      console.warn('Notice querying grade_records for student info:', gErr.message);
    }

    // 3. Check if active account already exists
    const { data: accounts } = await supabase
      .from('accounts')
      .select('*')
      .or(`student_id.in.(${idVariants.map(v => `"${v}"`).join(',')}),username.in.(${idVariants.map(v => `"${v}"`).join(',')})`)
      .limit(1);

    const activeAccount = accounts?.[0] || null;

    // Determine canonical details from either students table or grade_records
    const resolvedFullName = student?.full_name || gradeRow?.full_name || '';
    const resolvedCourse = student?.program || gradeRow?.course || 'BSIT';
    const resolvedYearLevel = student?.year_level || gradeRow?.year_level || 1;
    const existsInDatabase = Boolean(student || gradeRow);

    if (student && (student.verified === 1 || student.verified === true)) {
      // RETURNING student: verified in students table
      return res.json({
        studentId: cleanId,
        exists: true,
        existsInDatabase: true,
        verified: true,
        isReturning: true,
        hasActiveAccount: Boolean(activeAccount),
        accountStatus: activeAccount?.status || null,
        student: {
          student_id: student.student_id || cleanId,
          full_name: resolvedFullName,
          program: resolvedCourse,
          year_level: resolvedYearLevel,
          schedule: student.schedule || student.section
        }
      });
    }

    // FIRST-TIME student: unverified or new, but may exist in database/grades!
    res.json({
      studentId: cleanId,
      exists: existsInDatabase,
      existsInDatabase,
      verified: false,
      isFirstTime: true,
      hasActiveAccount: Boolean(activeAccount),
      accountStatus: activeAccount?.status || null,
      student: existsInDatabase ? {
        student_id: student?.student_id || gradeRow?.student_id || cleanId,
        full_name: resolvedFullName,
        last_name: gradeRow?.last_name || '',
        first_name: gradeRow?.first_name || '',
        program: resolvedCourse,
        year_level: resolvedYearLevel
      } : null
    });
  } catch (error) {
    console.error('Check Student Status Error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Request 6-digit OTP code sent to Gmail for Student Registration
 * POST /api/auth/send-registration-otp
 */
async function sendRegistrationOtpHandler(req, res) {
  try {
    const { student_id, first_name, last_name, middle_name, full_name, email, program } = req.body;

    const cleanId = String(student_id || '').trim();
    const cleanFirst = String(first_name || '').trim();
    const cleanLast = String(last_name || '').trim();
    const cleanMiddle = String(middle_name || '').trim();
    const combinedName = (cleanLast && cleanFirst)
      ? (cleanMiddle ? `${cleanLast}, ${cleanFirst} ${cleanMiddle}` : `${cleanLast}, ${cleanFirst}`)
      : String(full_name || '').trim();

    if (!cleanId || !combinedName || !email) {
      return res.status(400).json({ error: 'Student ID, Name (Last Name & First Name), and Gmail address are required.' });
    }

    const cleanName = combinedName;
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanProgram = String(program || 'BSIT').trim().toUpperCase();

    if (!cleanEmail.includes('@')) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    if (!['BSIT', 'BSCS'].includes(cleanProgram)) {
      return res.status(400).json({ error: "Invalid Program. Only 'BSIT' or 'BSCS' are accepted." });
    }

    // Check if an active account already exists for this student_id
    const { data: existingAccounts } = await supabase
      .from('accounts')
      .select('*')
      .or(`username.eq.${cleanId},student_id.eq.${cleanId}`)
      .limit(1);

    const existingAccount = existingAccounts?.[0];
    if (existingAccount) {
      if (existingAccount.status === 'pending') {
        return res.status(400).json({
          error: 'An account registration for this Student ID is already submitted and currently awaiting Admin approval.'
        });
      }
      return res.status(400).json({
        error: 'An active account for this Student ID already exists. Please log in directly.'
      });
    }

    // Generate secure 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    const otpPayload = {
      otp: otpCode,
      student_id: cleanId,
      first_name: cleanFirst,
      last_name: cleanLast,
      middle_name: cleanMiddle,
      full_name: cleanName,
      email: cleanEmail,
      program: cleanProgram,
      expiresAt
    };

    registrationOtpStore.set(cleanEmail, otpPayload);
    registrationOtpStore.set(cleanId, otpPayload);

    const result = await sendRegistrationOtp(cleanEmail, otpCode, cleanName);

    console.log(`📩 Registration OTP ${otpCode} issued for ${cleanId} (${cleanEmail})`);

    res.json({
      success: true,
      message: `A 6-digit verification code has been sent to ${cleanEmail}. Please enter the code to complete your registration.`,
      email: cleanEmail,
      student_id: cleanId,
      expiresInMinutes: 10,
      delivered: Boolean(result?.delivered),
      simulated: Boolean(result?.simulated),
      devOtp: result?.simulated ? otpCode : undefined
    });
  } catch (error) {
    console.error('Request Registration OTP Error:', error);
    res.status(500).json({ error: error.message || 'Failed to send verification code.' });
  }
}

/**
 * Student Self-Registration (Mano-mano input + Gmail OTP verification)
 * NO ID photos, NO selfie photos, NO year level field required.
 * Account is created with status = 'pending' awaiting Admin approval.
 * Once approved, system generates a random password valid for 1 week and sends via Gmail.
 * POST /api/register and /api/auth/register
 */
async function registerStudent(req, res) {
  try {
    const {
      student_id,
      first_name,
      last_name,
      middle_name,
      full_name,
      email,
      program,
      otp
    } = req.body;

    const cleanId = String(student_id || '').trim();
    const cleanFirst = String(first_name || '').trim();
    const cleanLast = String(last_name || '').trim();
    const cleanMiddle = String(middle_name || '').trim();
    const combinedName = (cleanLast && cleanFirst)
      ? (cleanMiddle ? `${cleanLast}, ${cleanFirst} ${cleanMiddle}` : `${cleanLast}, ${cleanFirst}`)
      : String(full_name || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanProgram = String(program || 'BSIT').trim().toUpperCase();
    const cleanOtp = String(otp || '').trim();

    // 1. Mandatory Validations
    if (!cleanId || !combinedName || !cleanEmail || !cleanOtp) {
      return res.status(400).json({ error: 'Student ID, Name (Last Name & First Name), Email, and 6-digit OTP verification code are required.' });
    }

    if (!['BSIT', 'BSCS'].includes(cleanProgram)) {
      return res.status(400).json({ error: "Invalid Program. Only 'BSIT' or 'BSCS' are accepted." });
    }

    // 2. Verify OTP
    const record = registrationOtpStore.get(cleanEmail) || registrationOtpStore.get(cleanId);
    if (!record) {
      return res.status(400).json({
        error: 'No active verification code found for this email or student ID. Please request a new code.'
      });
    }

    if (Date.now() > record.expiresAt) {
      registrationOtpStore.delete(cleanEmail);
      registrationOtpStore.delete(cleanId);
      return res.status(400).json({
        error: 'Verification code has expired. Please request a new code.'
      });
    }

    if (record.otp !== cleanOtp) {
      return res.status(400).json({
        error: 'Invalid verification code. Please check your code and try again.'
      });
    }

    // 3. Check if active account already exists
    const { data: existingAccounts } = await supabase
      .from('accounts')
      .select('*')
      .or(`username.eq.${cleanId},student_id.eq.${cleanId}`)
      .limit(1);

    const existingAccount = existingAccounts?.[0];
    if (existingAccount) {
      if (existingAccount.status === 'pending') {
        return res.status(400).json({
          error: 'An account registration for this Student ID is already submitted and currently awaiting Admin approval.'
        });
      }
      return res.status(400).json({
        error: 'An active account for this Student ID already exists. Please log in directly.'
      });
    }

    // Verified! Clear OTP from memory
    registrationOtpStore.delete(cleanEmail);
    registrationOtpStore.delete(cleanId);

    const now = new Date().toISOString();
    const accountId = 'acc-' + Date.now();

    // 4. Resolve year level: check by student_id or name in students & grade_records
    let resolvedYearLevel = 1;
    let existingStudentDbId = 'student-' + Date.now();

    const { data: existingStudents } = await supabase
      .from('students')
      .select('*')
      .eq('student_id', cleanId)
      .limit(1);

    let existingStudent = existingStudents?.[0];
    if (!existingStudent && cleanLast && cleanFirst) {
      const { data: nameStudents } = await supabase
        .from('students')
        .select('*')
        .ilike('full_name', `%${cleanLast}%`)
        .limit(1);
      if (nameStudents?.length) existingStudent = nameStudents[0];
    }

    if (existingStudent) {
      existingStudentDbId = existingStudent.id || existingStudentDbId;
      resolvedYearLevel = existingStudent.year_level || 1;
    } else {
      try {
        let { data: gData } = await supabase
          .from('grade_records')
          .select('year_level')
          .eq('student_id', cleanId)
          .order('year_level', { ascending: false })
          .limit(1);

        if (!gData?.length && cleanLast && cleanFirst) {
          const { data: nameGrades } = await supabase
            .from('grade_records')
            .select('year_level')
            .ilike('last_name', cleanLast)
            .ilike('first_name', cleanFirst)
            .order('year_level', { ascending: false })
            .limit(1);
          if (nameGrades?.length) gData = nameGrades;
        }

        if (gData && gData[0]?.year_level) {
          resolvedYearLevel = Number(gData[0].year_level) || 1;
        }
      } catch (e) {}
    }

    // 5. Upsert into students table (NO PHOTOS, verified = false, status = 'pending')
    const cleanName = combinedName;
    const { error: studentErr } = await supabase.from('students').upsert([{
      student_id: cleanId,
      id: existingStudentDbId,
      full_name: cleanName,
      email: cleanEmail,
      program: cleanProgram,
      year_level: resolvedYearLevel,
      schedule: 'Schedule 1',
      id_front_path: null,
      id_back_path: null,
      selfie_path: null,
      id_front_image: null,
      id_back_image: null,
      selfie_image: null,
      verified: false,
      status: 'pending',
      created_at: existingStudent?.created_at || now
    }], { onConflict: 'student_id' });

    if (studentErr) {
      console.error('❌ Supabase Students Table Insert Error:', studentErr);
      throw new Error(`Database error (students table): ${studentErr.message}`);
    }

    // 6. Upsert into accounts table with status = 'pending' and temporary locked password hash
    const lockedHash = await bcrypt.hash('LOCKED_PENDING_ADMIN_APPROVAL_' + Date.now(), 10);
    const { error: accountErr } = await supabase.from('accounts').upsert([{
      id: accountId,
      student_id: cleanId,
      username: cleanId,
      password_hash: lockedHash,
      role: 'student',
      status: 'pending',
      bulk_imported: false,
      created_at: now
    }], { onConflict: 'username' });

    if (accountErr) {
      console.error('❌ Supabase Accounts Table Insert Error:', accountErr);
      throw new Error(`Database error (accounts table): ${accountErr.message}`);
    }

    // 7. Upsert into profiles table for sync
    await supabase.from('profiles').upsert([{
      id: accountId,
      email: cleanEmail,
      role: 'student',
      full_name: cleanName,
      approval_status: 'pending',
      created_at: now
    }], { onConflict: 'email' });

    console.log(`✅ [REGISTRATION SUBMITTED] Student ${cleanId} (${cleanName}) submitted registration, awaiting Admin approval.`);

    return res.status(201).json({
      message: 'Registration submitted successfully! Your account details have been verified via OTP and queued for approval by the Registrar Admin. Once approved, your temporary system-generated password (valid for one week) will be sent to your Gmail.',
      status: 'pending',
      student_id: cleanId,
      full_name: cleanName,
      email: cleanEmail,
      program: cleanProgram
    });
  } catch (error) {
    console.error('Register Student Error:', error);
    res.status(500).json({ error: error.message || 'Registration failed' });
  }
}


/**
 * Get active authenticated user profile
 * GET /api/auth/me
 */
async function getMe(req, res) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    let studentRecord = null;
    let fullName = user.full_name;
    if (user.role === 'student') {
      const rawSId = String(user.student_id || user.username || '').trim();
      const bareSId = rawSId.replace(/^(s-|student-|acc-|gct-)/i, '').trim();
      const lookupIds = Array.from(new Set([rawSId, bareSId, `GCT-${bareSId}`].filter(Boolean)));
      const orClauses = [];
      lookupIds.forEach(val => {
        orClauses.push(`student_id.eq.${val}`);
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) {
          orClauses.push(`id.eq.${val}`);
        }
      });
      const orFilter = orClauses.length > 0 ? orClauses.join(',') : `student_id.eq.${rawSId}`;

      const { data: students } = await supabase
        .from('students')
        .select('*')
        .or(orFilter)
        .limit(1);

      studentRecord = students?.[0] || null;
      if (studentRecord) {
        fullName = studentRecord.full_name || fullName;
      } else {
        try {
          const { data: gData } = await supabase
            .from('grade_records')
            .select('full_name, course, year_level')
            .in('student_id', lookupIds)
            .limit(1);
          if (gData && gData[0]) {
            fullName = gData[0].full_name || fullName;
            studentRecord = {
              student_id: bareSId,
              full_name: gData[0].full_name,
              program: gData[0].course || 'BSIT',
              year_level: gData[0].year_level || 1
            };
          }
        } catch (e) { }
      }
    }

    res.json({
      user: {
        ...user,
        full_name: fullName || user.full_name,
        email: studentRecord?.email || user.email || '',
        program: studentRecord?.program || 'BSIT',
        year_level: studentRecord?.year_level || 1,
        schedule: studentRecord?.schedule || studentRecord?.section || 'Default'
      },
      student: studentRecord
    });
  } catch (error) {
    console.error('GetMe Error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Forgot Password - Request 6-digit OTP to registered email
 * POST /api/auth/forgot-password
 */
async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Please enter the email address used to create your account.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Search in students table FIRST (to get their real student_id like 12310!)
    let foundUser = null;
    let recipientName = 'Student';
    let targetUsername = null;
    let studentId = null;

    const { data: students } = await supabase
      .from('students')
      .select('*')
      .or(`email.ilike.${cleanEmail},student_id.eq.${cleanEmail.split('@')[0]}`)
      .limit(1);

    if (students && students.length > 0) {
      foundUser = students[0];
      recipientName = foundUser.full_name || 'Student';
      studentId = foundUser.student_id;
      targetUsername = foundUser.student_id;
    }

    // 2. Search in profiles table
    if (!foundUser) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .ilike('email', cleanEmail)
        .limit(1);

      if (profiles && profiles.length > 0) {
        foundUser = profiles[0];
        recipientName = foundUser.full_name || 'User';
        targetUsername = foundUser.email?.split('@')[0] || foundUser.id;
      }
    }

    // 3. Search in accounts table
    if (!foundUser) {
      const handle = cleanEmail.includes('@') ? cleanEmail.split('@')[0] : cleanEmail;
      const { data: accounts } = await supabase
        .from('accounts')
        .select('*')
        .or(`username.ilike.${handle},student_id.ilike.${handle}`)
        .limit(1);

      if (accounts && accounts.length > 0) {
        foundUser = accounts[0];
        targetUsername = foundUser.username;
        studentId = foundUser.student_id;
        recipientName = targetUsername;
      }
    }

    // If still not found, check if it's admin or registrar account
    if (!foundUser && (cleanEmail === 'admin@gct.edu.ph' || cleanEmail === 'registrar_admin')) {
      targetUsername = 'registrar_admin';
      recipientName = 'System Administrator';
      foundUser = { role: 'registrar_admin' };
    }

    if (!foundUser) {
      return res.status(404).json({
        error: `No registered account found with email '${cleanEmail}'. Please make sure to enter the exact email used during registration.`
      });
    }

    // Generate secure 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes from now

    // Store in memory
    otpStore.set(cleanEmail, {
      otp: otpCode,
      expiresAt,
      recipientName,
      targetEmail: cleanEmail,
      username: targetUsername,
      studentId: studentId || targetUsername
    });

    // Send email via emailService
    const sendResult = await sendPasswordResetOtp(cleanEmail, otpCode, recipientName);

    res.json({
      message: `A 6-digit verification code has been sent to ${cleanEmail}. Please check your inbox or spam folder.`,
      email: cleanEmail,
      expiresInMinutes: 10,
      delivered: Boolean(sendResult?.delivered)
    });
  } catch (error) {
    console.error('Forgot Password Error:', error);
    res.status(500).json({ error: error.message || 'Failed to process password reset request' });
  }
}

/**
 * Verify 6-digit OTP code before proceeding to new password step
 * POST /api/auth/verify-otp
 */
async function verifyOtp(req, res) {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and 6-digit OTP code are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const record = otpStore.get(cleanEmail);

    if (!record) {
      return res.status(400).json({
        error: 'No active password reset request found for this email, or the code has expired. Please request a new code.'
      });
    }

    if (Date.now() > record.expiresAt) {
      otpStore.delete(cleanEmail);
      return res.status(400).json({ error: 'Verification code has expired. Please request a new code.' });
    }

    if (record.otp !== String(otp).trim()) {
      return res.status(400).json({ error: 'Invalid verification code. Please check your code and try again.' });
    }

    res.json({
      valid: true,
      message: 'Code verified successfully! You may now set your new password.'
    });
  } catch (error) {
    console.error('Verify OTP Error:', error);
    res.status(500).json({ error: error.message || 'Failed to verify code' });
  }
}

/**
 * Reset Password using 6-Digit Email OTP
 * POST /api/auth/reset-password
 */
async function resetPasswordWithOtp(req, res) {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'Email, 6-digit OTP code, and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const record = otpStore.get(cleanEmail);

    if (!record) {
      return res.status(400).json({
        error: 'No active password reset request found for this email, or the verification code has expired. Please request a new code.'
      });
    }

    if (Date.now() > record.expiresAt) {
      otpStore.delete(cleanEmail);
      return res.status(400).json({ error: 'Verification code has expired. Please request a new code.' });
    }

    if (record.otp !== String(otp).trim()) {
      return res.status(400).json({ error: 'Invalid verification code. Please check your code and try again.' });
    }

    // Hash the new password with bcrypt
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const targetStudentId = record.studentId || record.username || cleanEmail.split('@')[0];

    // Find student info if available
    let studentFullName = record.recipientName;
    try {
      const { data: stData } = await supabase
        .from('students')
        .select('*')
        .or(`email.ilike.${cleanEmail},student_id.eq.${targetStudentId}`)
        .limit(1);
      if (stData && stData[0]) {
        studentFullName = stData[0].full_name || studentFullName;
      }
    } catch (e) {}

    // 1. Upsert into accounts table
    const searchConditions = [
      `username.ilike.${cleanEmail}`,
      `student_id.eq.${targetStudentId}`,
      `username.eq.${targetStudentId}`
    ];
    if (cleanEmail.includes('@')) {
      searchConditions.push(`username.ilike.${cleanEmail.split('@')[0]}`);
    }

    const { data: existingAccounts } = await supabase
      .from('accounts')
      .select('*')
      .or(searchConditions.join(','))
      .limit(1);

    if (existingAccounts && existingAccounts.length > 0) {
      await supabase
        .from('accounts')
        .update({
          student_id: existingAccounts[0].student_id || targetStudentId,
          password_hash: passwordHash,
          status: 'approved',
          bulk_imported: true
        })
        .eq('id', existingAccounts[0].id);
    } else {
      await supabase
        .from('accounts')
        .insert([{
          id: `acc-${Date.now()}`,
          student_id: targetStudentId,
          username: targetStudentId,
          password_hash: passwordHash,
          role: 'student',
          status: 'approved',
          bulk_imported: true,
          created_at: new Date().toISOString()
        }]);
    }

    // 2. Upsert into profiles table
    try {
      const { data: existingProfiles } = await supabase
        .from('profiles')
        .select('*')
        .or(`email.ilike.${cleanEmail},id.eq.${targetStudentId}`)
        .limit(1);

      if (existingProfiles && existingProfiles.length > 0) {
        await supabase
          .from('profiles')
          .update({
            password_hash: passwordHash,
            approval_status: 'approved'
          })
          .eq('id', existingProfiles[0].id);
      } else {
        await supabase
          .from('profiles')
          .insert([{
            id: `prof-${Date.now()}`,
            email: cleanEmail,
            full_name: studentFullName || 'Student',
            role: 'student',
            password_hash: passwordHash,
            approval_status: 'approved',
            created_at: new Date().toISOString()
          }]);
      }
    } catch (pErr) {}

    // 3. Ensure students table has clean email
    try {
      await supabase
        .from('students')
        .update({ email: cleanEmail })
        .eq('student_id', targetStudentId);
    } catch (sErr) {}

    // Clear used OTP
    otpStore.delete(cleanEmail);

    console.log(`✅ [PASSWORD RESET SUCCESS] Successfully updated password for student '${targetStudentId}' (${cleanEmail})`);

    res.json({
      message: 'Password successfully reset! You can now log in with your new password.',
      username: targetStudentId,
      student_id: targetStudentId
    });
  } catch (error) {
    console.error('Reset Password Error:', error);
    res.status(500).json({ error: error.message || 'Failed to reset password' });
  }
}

module.exports = {
  loginUser,
  checkStudentStatus,
  sendRegistrationOtpHandler,
  registerStudent,
  getMe,
  forgotPassword,
  verifyOtp,
  resetPasswordWithOtp,
  registrationOtpStore
};
