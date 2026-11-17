import { describe, it, expect } from 'vitest';
const {
  cleanMemorandumFormatting,
  buildGradesTableMarkdown,
  buildRecommendationsTableMarkdown,
  buildDeficienciesTableMarkdown,
  buildStudentsTableMarkdown,
  classifyStudentQueryIntent,
  formatTargetTermText,
  generateStudentCsv,
  ensureFollowUpQuestion,
  generateFollowUpQuestions,
  isStudentGreetingQuery,
  buildStudentGreetingResponse,
  queryChatbot,
  parseCohortFilter,
  isCohortDetailsComplete,
  generateCurriculumRecsCsv,
  generateCohortGradesCsv
} = require('../controllers/chatbotController');

describe('Chatbot Table Formatting & Anti-Memorandum Sanitizer', () => {
  it('strips institutional MEMORANDUM headers and TO/FROM/DATE/SUBJECT', () => {
    const rawMemo = `MEMORANDUM
TO: System Administrator, Registrar Operations
FROM: GCT Registrar Operations Assistant
DATE: October 24, 2023
SUBJECT: Comprehensive Academic Assessment and Subject Recommendations for Tolibas, Niño (ID: 12310)

1. STUDENT PROFILE SUMMARY
Student Name: Tolibas, Niño
Student ID: 12310

2. FORMAL REGISTRAR EVALUATION
Satisfactory standing.`;

    const cleaned = cleanMemorandumFormatting(rawMemo);
    expect(cleaned).not.toContain('MEMORANDUM');
    expect(cleaned).not.toContain('TO: System Administrator');
    expect(cleaned).not.toContain('FROM: GCT Registrar');
    expect(cleaned).not.toContain('DATE:');
    expect(cleaned).not.toContain('SUBJECT:');
    expect(cleaned).toContain('### STUDENT PROFILE SUMMARY');
    expect(cleaned).toContain('### FORMAL REGISTRAR EVALUATION');
    expect(cleaned).toContain('Tolibas, Niño');
  });

  it('generates a valid markdown table for student grades with pipe delimiters', () => {
    const records = [
      { code: 'CC 101', title: 'Intro to Computing', units: 3, grade: 1.75, status: 'passed', term: '2023-2024 1st Sem' },
      { code: 'CC 102', title: 'Computer Programming 1', units: 3, grade: 2.0, status: 'passed', term: '2023-2024 1st Sem' }
    ];

    const table = buildGradesTableMarkdown(records);
    expect(table).toContain('| Subject Code | Description | Units | Grade | Status | Academic Term |');
    expect(table).toContain('| `CC 101` | Intro to Computing | 3 | **1.75** | Passed | 2023-2024 1st Sem |');
    expect(table).toContain('| `CC 102` | Computer Programming 1 | 3 | **2.00** | Passed | 2023-2024 1st Sem |');
  });

  it('generates a valid markdown table for subject recommendations with classifications', () => {
    const recommendations = [
      { code: 'IT 4', title: 'Advanced Database Systems', units: 3, reason: 'unlocked', notes: 'Prerequisites satisfied (CC 106)' },
      { code: 'CC 103', title: 'Intermediate Programming', units: 3, reason: 'retake', notes: 'Unresolved deficiency' }
    ];

    const table = buildRecommendationsTableMarkdown(recommendations);
    expect(table).toContain('| Subject Code | Description | Units | Classification | Prerequisites / Notes |');
    expect(table).toContain('| `IT 4` | Advanced Database Systems | 3 | **Regular Load** | Prerequisites satisfied (CC 106) |');
    expect(table).toContain('| `CC 103` | Intermediate Programming | 3 | **Mandatory Retake** | Unresolved deficiency |');
  });

  it('generates a valid markdown table for student rosters', () => {
    const students = [
      { student_id: '12310', full_name: 'Niño Tolibas', program: 'BSIT', year_level: 2, status: 'Active' },
      { student_id: '12311', full_name: 'Maria Santos', program: 'BSIT', year_level: 1, status: 'Active' }
    ];

    const table = buildStudentsTableMarkdown(students);
    expect(table).toContain('| Student ID | Full Name | Program | Year Level | Status |');
    expect(table).toContain('| `12310` | **Niño Tolibas** | BSIT | Year 2 | Active |');
    expect(table).toContain('| `12311` | **Maria Santos** | BSIT | Year 1 | Active |');
  });

  it('correctly classifies student query intents', () => {
    expect(classifyStudentQueryIntent('Ano ang recommended subjects para sa kanya?')).toBe('recommendation');
    expect(classifyStudentQueryIntent('What subjects should he take next semester?')).toBe('recommendation');
    expect(classifyStudentQueryIntent('Show me his grades')).toBe('grades');
    expect(classifyStudentQueryIntent('Ano ang marka ni Tolibas?')).toBe('grades');
    expect(classifyStudentQueryIntent('give me the record of the student')).toBe('grades');
    expect(classifyStudentQueryIntent('record of Jazper Francisco')).toBe('grades');
    expect(classifyStudentQueryIntent('records of 2024-0001')).toBe('grades');
    expect(classifyStudentQueryIntent('pakita ang record ni student')).toBe('grades');
    expect(classifyStudentQueryIntent('give me the assessment of the student')).toBe('comprehensive');
    expect(classifyStudentQueryIntent('assessment of student 2024-0001')).toBe('comprehensive');
    expect(classifyStudentQueryIntent('can you evaluate student records?')).toBe('comprehensive');
    expect(classifyStudentQueryIntent('pagsusuri sa rekord ng estudyante')).toBe('comprehensive');
    expect(classifyStudentQueryIntent('Comprehensive assessment of student 12310')).toBe('comprehensive');
    expect(classifyStudentQueryIntent('hi')).toBe('greeting');
    expect(classifyStudentQueryIntent('hello')).toBe('greeting');
    expect(classifyStudentQueryIntent('kumusta po')).toBe('greeting');
    expect(classifyStudentQueryIntent('good morning')).toBe('greeting');
  });

  it('correctly identifies student greetings vs substantive queries', () => {
    // Pure greetings
    expect(isStudentGreetingQuery('hi')).toBe(true);
    expect(isStudentGreetingQuery('hello')).toBe(true);
    expect(isStudentGreetingQuery('hey')).toBe(true);
    expect(isStudentGreetingQuery('hi po')).toBe(true);
    expect(isStudentGreetingQuery('hello po!')).toBe(true);
    expect(isStudentGreetingQuery('good morning')).toBe(true);
    expect(isStudentGreetingQuery('good afternoon')).toBe(true);
    expect(isStudentGreetingQuery('good evening')).toBe(true);
    expect(isStudentGreetingQuery('kumusta')).toBe(true);
    expect(isStudentGreetingQuery('kamusta')).toBe(true);
    expect(isStudentGreetingQuery('kumusta po')).toBe(true);
    expect(isStudentGreetingQuery('magandang araw po')).toBe(true);
    expect(isStudentGreetingQuery('magandang umaga')).toBe(true);
    expect(isStudentGreetingQuery('hi chatbot')).toBe(true);
    expect(isStudentGreetingQuery('hello how are you')).toBe(true);

    // Queries with academic or transactional requests must NOT be classified as greetings
    expect(isStudentGreetingQuery('hi what is my gwa')).toBe(false);
    expect(isStudentGreetingQuery('hello pakita mo grades ko')).toBe(false);
    expect(isStudentGreetingQuery('recommend subjects for next sem')).toBe(false);
    expect(isStudentGreetingQuery('pwede na ba ako mag-enroll?')).toBe(false);
    expect(isStudentGreetingQuery('download my record in excel')).toBe(false);
    expect(isStudentGreetingQuery('1st Sem')).toBe(false);
    expect(isStudentGreetingQuery('What is my GWA and standing?')).toBe(false);
  });

  it('builds conversational greeting without dumping tables or academic assessment', () => {
    const greetingEn = buildStudentGreetingResponse('hi', 'Mark Lester Arevalo', false);
    expect(greetingEn).toContain('Hello, **Mark Lester Arevalo**!');
    expect(greetingEn).toContain('GCT Student AI Assistant');
    expect(greetingEn).not.toContain('| Subject Code | Description |');
    expect(greetingEn).not.toContain('Cumulative GWA:');
    expect(greetingEn).not.toContain('Passed Units:');
    expect(greetingEn.endsWith('?')).toBe(true);
    // Strict zero emojis check
    expect(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(greetingEn)).toBe(false);

    const greetingTl = buildStudentGreetingResponse('kumusta po', 'Mark Lester Arevalo', true);
    expect(greetingTl).toContain('Mark Lester Arevalo');
    expect(greetingTl).toContain('GCT Student AI Assistant');
    expect(greetingTl).not.toContain('| Subject Code | Description |');
    expect(greetingTl).not.toContain('Cumulative GWA:');
    expect(greetingTl.endsWith('?')).toBe(true);
    expect(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(greetingTl)).toBe(false);

    const morningEn = buildStudentGreetingResponse('good morning', 'Mark', false);
    expect(morningEn).toContain('Good morning, **Mark**!');
  });

  it('formats target terms properly', () => {
    expect(formatTargetTermText(2, 2)).toBe('Year 2, 2nd Semester');
    expect(formatTargetTermText(3, 3)).toBe('Year 3, Summer');
    expect(formatTargetTermText(1, 1)).toBe('Year 1, 1st Semester');
  });

  it('generates institutional grade CSV with exactly 2-decimal grades (1.00, 1.50, 2.00, 3.00, 5.00) and recommended subjects below', () => {
    const student = { student_id: '12350', name: 'Francisco, Mark', program: 'BSIT', year_level: 1 };
    const records = [
      { code: 'CC 101', title: 'Intro to Computing', units: 3, grade: 1, status: 'passed', term: '2025-2026 1st Sem' },
      { code: 'C.O. 1', title: 'College Orientation', units: 1, grade: 1.5, status: 'passed', term: '2025-2026 1st Sem' },
      { code: 'UTS 1', title: 'Understanding the Self', units: 3, grade: 2.25, status: 'passed', term: '2025-2026 1st Sem' },
      { code: 'History 1', title: 'Readings in History', units: 3, grade: 3, status: 'passed', term: '2025-2026 1st Sem' },
      { code: 'Math 1', title: 'College Algebra', units: 3, grade: 5, status: 'failed', term: '2025-2026 1st Sem' }
    ];
    const recommendedSubjects = [
      { code: 'CC 102', title: 'Computer Programming 1', units: 3, year: 1, semester: '2nd Sem', prerequisites: 'CC 101', isPrereqMet: true }
    ];

    const csv = generateStudentCsv(student, records, '2.55', {
      recommendedSubjects,
      targetTermText: '2025-2026 2nd Sem'
    });

    expect(csv).toContain('Student ID,Student Name,Program,Year Level,Subject Code,Subject Title,Units,Grade,Status,Academic Term');
    expect(csv).toContain('"12350","Francisco, Mark","BSIT",1,"CC 101","Intro to Computing",3,"1.00","passed","2025-2026 1st Sem"');
    expect(csv).toContain('"12350","Francisco, Mark","BSIT",1,"C.O. 1","College Orientation",1,"1.50","passed","2025-2026 1st Sem"');
    expect(csv).toContain('"12350","Francisco, Mark","BSIT",1,"UTS 1","Understanding the Self",3,"2.25","passed","2025-2026 1st Sem"');
    expect(csv).toContain('"12350","Francisco, Mark","BSIT",1,"History 1","Readings in History",3,"3.00","passed","2025-2026 1st Sem"');
    expect(csv).toContain('"12350","Francisco, Mark","BSIT",1,"Math 1","College Algebra",3,"5.00","failed","2025-2026 1st Sem"');
    expect(csv).toContain('RECOMMENDED SUBJECTS (2025-2026 2nd Sem)');
    expect(csv).toContain('CC 102');
  });

  it('omits recommended subjects when CSV export intent is grades', () => {
    const student = { student_id: '12350', name: 'Francisco, Mark', program: 'BSIT', year_level: 1 };
    const records = [
      { code: 'CC 101', title: 'Intro to Computing', units: 3, grade: 1.75, status: 'passed', term: '2025-2026 1st Sem' }
    ];
    const recommendedSubjects = [
      { code: 'CC 102', title: 'Computer Programming 1', units: 3, year: 1, semester: '2nd Sem', prerequisites: 'CC 101', isPrereqMet: true }
    ];

    const csv = generateStudentCsv(student, records, '1.75', {
      intent: 'grades',
      recommendedSubjects,
      targetTermText: '2025-2026 2nd Sem'
    });

    expect(csv).toContain('Student ID,Student Name,Program,Year Level,Subject Code,Subject Title,Units,Grade,Status,Academic Term');
    expect(csv).toContain('"12350","Francisco, Mark","BSIT",1,"CC 101","Intro to Computing",3,"1.75","passed","2025-2026 1st Sem"');
    expect(csv).not.toContain('RECOMMENDED SUBJECTS');
    expect(csv).not.toContain('CC 102');
  });

  it('guarantees all question answers end with a follow-up question via ensureFollowUpQuestion', () => {
    // When text does NOT end with a question mark
    const staticStudentText = 'Here is your official grade sheet for 1st Year 1st Sem.';
    const ensuredStudent = ensureFollowUpQuestion(staticStudentText, { role: 'student', intent: 'grades', userIsTagalog: false });
    expect(ensuredStudent.trim().endsWith('?')).toBe(true);
    expect(ensuredStudent).toContain('Would you like me to evaluate your overall standing and show your recommended subjects for next semester?');

    // When text in Tagalog does NOT end with a question mark
    const staticTagalogText = 'Narito ang iyong opisyal na grado.';
    const ensuredTagalog = ensureFollowUpQuestion(staticTagalogText, { role: 'student', intent: 'grades', userIsTagalog: true });
    expect(ensuredTagalog.trim().endsWith('?')).toBe(true);
    expect(ensuredTagalog).toContain('Nais mo bang suriin natin ang iyong overall standing');

    // When text for Registrar does not end with a question mark and lacks details (e.g. grades without term)
    const staticRegistrarText = 'Evaluated records for student 12310.';
    const ensuredRegistrar = ensureFollowUpQuestion(staticRegistrarText, { role: 'registrar_admin', intent: 'grades', studentId: '12310', userIsTagalog: false });
    expect(ensuredRegistrar.trim().endsWith('?')).toBe(true);
    expect(ensuredRegistrar).toContain('Would you like me to compute recommended subjects for 12310');

    // When text for Registrar already provided full details (e.g. comprehensive assessment), do not append redundant follow-up question
    const comprehensiveRegistrarText = '### Academic Assessment & Recommendations: Student 12310';
    const ensuredComp = ensureFollowUpQuestion(comprehensiveRegistrarText, { role: 'registrar_admin', intent: 'comprehensive', studentId: '12310' });
    expect(ensuredComp).toBe(comprehensiveRegistrarText);

    // When text for Guest does not end with a question mark
    const staticGuestText = 'Welcome to GCT.';
    const ensuredGuest = ensureFollowUpQuestion(staticGuestText, { role: 'guest', userIsTagalog: false });
    expect(ensuredGuest.trim().endsWith('?')).toBe(true);
    expect(ensuredGuest).toContain('Would you like more details regarding admission requirements');

    // When text ALREADY ends with a question mark, preserve it without duplicate
    const alreadyQuestion = 'Which academic term would you like to view?';
    const preserved = ensureFollowUpQuestion(alreadyQuestion, { role: 'student', intent: 'grades', userIsTagalog: false });
    expect(preserved).toBe('Which academic term would you like to view?');
  });

  it('generates contextual follow-up questions for UI chips, excluding admin/staff to prevent FAQ clutter', () => {
    const studentFollowUps = generateFollowUpQuestions({ role: 'student', intent: 'grades', userIsTagalog: false });
    expect(Array.isArray(studentFollowUps)).toBe(true);
    expect(studentFollowUps.length).toBeGreaterThanOrEqual(2);
    expect(studentFollowUps.some(q => q.includes('eligible for next semester'))).toBe(true);

    // Admin/Staff: FAQ chips are disabled to maintain clean institutional interface
    const registrarFollowUps = generateFollowUpQuestions({ role: 'registrar_admin', intent: 'grades', studentId: '12310', userIsTagalog: false });
    expect(Array.isArray(registrarFollowUps)).toBe(true);
    expect(registrarFollowUps.length).toBe(0);

    const guestFollowUps = generateFollowUpQuestions({ role: 'guest', userIsTagalog: false });
    expect(Array.isArray(guestFollowUps)).toBe(true);
    expect(guestFollowUps.some(q => q.includes('Admission requirements'))).toBe(true);
  });

  it('Student role: queryChatbot returns friendly greeting without dumping assessment or grades tables when student says "hi"', async () => {
    const mockSupabase = {
      from: (table) => ({
        select: () => ({
          or: () => ({
            limit: () => ({
              data: [{ id: '10526', student_id: '10526', full_name: 'CHIN-CHIN ABAYON', name: 'CHIN-CHIN ABAYON', program: 'BSIT', year_level: 2 }]
            })
          }),
          eq: () => ({
            limit: () => ({ data: [] }),
            order: () => ({ data: [] }),
            in: () => ({ data: [] })
          }),
          in: () => ({ data: [] }),
          limit: () => ({ data: [] }),
          order: () => ({ data: [] })
        }),
        insert: () => ({ data: [] })
      })
    };

    let jsonResponse = null;
    const req = {
      body: { query: 'hi' },
      user: { id: '10526', student_id: '10526', role: 'student', full_name: 'CHIN-CHIN ABAYON' }
    };
    const res = {
      status() { return this; },
      json(data) { jsonResponse = data; return this; }
    };

    await queryChatbot(req, res, mockSupabase);

    expect(jsonResponse).not.toBeNull();
    // Must contain greeting addressed to student
    expect(jsonResponse.response).toContain('CHIN-CHIN ABAYON');
    expect(jsonResponse.response).toContain('GCT Student AI Assistant');
    // Must NOT contain assessment tables or grades tables!
    expect(jsonResponse.response).not.toContain('| Subject Code | Description |');
    expect(jsonResponse.response).not.toContain('Cumulative GWA:');
    // Must NOT attach an automatic file export on a greeting
    expect(jsonResponse.file_export).toBeNull();
    // Follow-up question chips should be available
    expect(Array.isArray(jsonResponse.follow_up_questions)).toBe(true);
    expect(jsonResponse.follow_up_questions.length).toBeGreaterThanOrEqual(2);
    // Strict zero emojis
    expect(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(jsonResponse.response)).toBe(false);
  });

  it('Student role: queryChatbot returns friendly Tagalog greeting when student greets in Tagalog', async () => {
    const mockSupabase = {
      from: (table) => ({
        select: () => ({
          or: () => ({
            limit: () => ({
              data: [{ id: '10526', student_id: '10526', full_name: 'CHIN-CHIN ABAYON', name: 'CHIN-CHIN ABAYON', program: 'BSIT', year_level: 2 }]
            })
          }),
          eq: () => ({
            limit: () => ({ data: [] }),
            order: () => ({ data: [] }),
            in: () => ({ data: [] })
          }),
          in: () => ({ data: [] }),
          limit: () => ({ data: [] }),
          order: () => ({ data: [] })
        }),
        insert: () => ({ data: [] })
      })
    };

    let jsonResponse = null;
    const req = {
      body: { query: 'kumusta po' },
      user: { id: '10526', student_id: '10526', role: 'student', full_name: 'CHIN-CHIN ABAYON' }
    };
    const res = {
      status() { return this; },
      json(data) { jsonResponse = data; return this; }
    };

    await queryChatbot(req, res, mockSupabase);

    expect(jsonResponse).not.toBeNull();
    expect(jsonResponse.response).toContain('CHIN-CHIN ABAYON');
    expect(jsonResponse.response).toContain('GCT Student AI Assistant');
    expect(jsonResponse.response).toContain('Paano kita matutulungan');
    expect(jsonResponse.response).not.toContain('| Subject Code | Description |');
    expect(jsonResponse.response).not.toContain('Cumulative GWA:');
    expect(jsonResponse.file_export).toBeNull();
    expect(Array.isArray(jsonResponse.follow_up_questions)).toBe(true);
    expect(jsonResponse.follow_up_questions[0]).toContain('Ano ang aking cumulative GWA');
    expect(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(jsonResponse.response)).toBe(false);
  });

  it('Admin/Staff role: queryChatbot returns "No student record found" when querying non-existent student 1111 without hallucinating fictitious student', async () => {
    const mockSupabase = {
      from: (table) => ({
        select: () => ({
          or: () => ({
            limit: () => ({ data: [] })
          }),
          ilike: () => ({
            limit: () => ({ data: [] })
          }),
          eq: () => ({
            limit: () => ({ data: [] }),
            order: () => ({ data: [] }),
            in: () => ({ data: [] })
          }),
          in: () => ({ data: [] }),
          limit: () => ({ data: [] }),
          order: () => ({ data: [] })
        }),
        insert: () => ({ data: [] })
      })
    };

    let jsonResponse = null;
    const req = {
      body: { query: 'show me the record of student 1111' },
      user: { id: 'admin-1', role: 'registrar_admin', full_name: 'Registrar Admin' }
    };
    const res = {
      status() { return this; },
      json(data) { jsonResponse = data; return this; }
    };

    await queryChatbot(req, res, mockSupabase);

    expect(jsonResponse).not.toBeNull();
    // Must explicitly state no student record was found
    expect(jsonResponse.response).toContain('No student record found');
    expect(jsonResponse.response).toContain('show me the record of student 1111');
    // Must NOT contain fictitious hallucinated student "Dela Cruz, Juan Miguel"
    expect(jsonResponse.response).not.toContain('Dela Cruz');
    expect(jsonResponse.response).not.toContain('Juan Miguel');
    // Must NOT contain hallucinated student record table
    expect(jsonResponse.response).not.toContain('Data Field');
    expect(jsonResponse.response).not.toContain('Student Detail');
    // File export must be null
    expect(jsonResponse.file_export).toBeNull();
    // Strict zero emojis
    expect(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(jsonResponse.response)).toBe(false);
  });

  describe('Cohort, Degree Program & Year Level Directory Queries', () => {
    it('parseCohortFilter correctly identifies year levels, programs, and grouping', () => {
      expect(parseCohortFilter('all year level')).toMatchObject({ isCohortQuery: true, yearLevel: 'all' });
      expect(parseCohortFilter('lahat ng year level')).toMatchObject({ isCohortQuery: true, yearLevel: 'all' });
      expect(parseCohortFilter('1st year only')).toMatchObject({ isCohortQuery: true, yearLevel: 1 });
      expect(parseCohortFilter('pakita records ng 2nd year')).toMatchObject({ isCohortQuery: true, yearLevel: 2 });
      expect(parseCohortFilter('3rd year students')).toMatchObject({ isCohortQuery: true, yearLevel: 3 });
      expect(parseCohortFilter('4th only')).toMatchObject({ isCohortQuery: true, yearLevel: 4 });
      expect(parseCohortFilter('by course or program')).toMatchObject({ isCohortQuery: true, isGroupByProgram: true });
      expect(parseCohortFilter('BSIT 2nd year tapos may excel din')).toMatchObject({ isCohortQuery: true, program: 'BSIT', yearLevel: 2 });
      expect(parseCohortFilter('show me BSCS records')).toMatchObject({ isCohortQuery: true, program: 'BSCS' });

      // Should NOT trigger cohort mode when a specific numeric student ID is present
      expect(parseCohortFilter('student 12310 2nd year').isCohortQuery).toBe(false);
      expect(parseCohortFilter('show record of student 1111').isCohortQuery).toBe(false);

      // Should NOT confuse semester with year level
      expect(parseCohortFilter('2025-2026 2nd Sem').isCohortQuery).toBe(false);
    });

    it('Admin/Staff: returns 2nd year records with Excel spreadsheet export when querying "2nd year only"', async () => {
      const mockStudentsList = [
        { id: '1', student_id: '10001', full_name: 'Santos, Maria', program: 'BSIT', year_level: 1, status: 'Active' },
        { id: '2', student_id: '10002', full_name: 'Reyes, John', program: 'BSIT', year_level: 2, status: 'Active' },
        { id: '3', student_id: '10003', full_name: 'Cruz, Carlos', program: 'BSCS', year_level: 2, status: 'Active' },
        { id: '4', student_id: '10004', full_name: 'Lim, Anna', program: 'BSHM', year_level: 3, status: 'Active' },
        { id: '5', student_id: '10005', full_name: 'Tan, David', program: 'BSIT', year_level: 4, status: 'Active' }
      ];

      const mockSupabase = {
        from: (table) => ({
          select: () => {
            const builder = {
              data: mockStudentsList,
              order: () => builder,
              limit: () => ({ data: [] }),
              or: () => ({ limit: () => ({ data: [] }) }),
              ilike: () => ({ limit: () => ({ data: [] }) }),
              eq: () => ({ limit: () => ({ data: [] }), order: () => ({ data: [] }) })
            };
            return builder;
          },
          insert: () => ({ data: [] })
        })
      };

      let jsonResponse = null;
      const req = {
        body: { query: 'pakita lahat ng record ng 2nd year tapos may excel din' },
        user: { id: 'admin-1', role: 'registrar_admin', full_name: 'Registrar Admin' }
      };
      const res = {
        status() { return this; },
        json(data) { jsonResponse = data; return this; }
      };

      await queryChatbot(req, res, mockSupabase);

      expect(jsonResponse).not.toBeNull();
      // Should mention 2nd Year
      expect(jsonResponse.response).toContain('2nd Year');
      // Should contain 2nd year students
      expect(jsonResponse.response).toContain('Reyes, John');
      expect(jsonResponse.response).toContain('Cruz, Carlos');
      // Should NOT contain 1st or 3rd or 4th year students in the roster
      expect(jsonResponse.response).not.toContain('Santos, Maria');
      expect(jsonResponse.response).not.toContain('Lim, Anna');
      expect(jsonResponse.response).not.toContain('Tan, David');

      // Excel export must be present
      expect(jsonResponse.file_export).not.toBeNull();
      expect(jsonResponse.file_export.format).toBe('excel');
      expect(jsonResponse.file_export.filename).toContain('2nd_Year');
      expect(jsonResponse.file_export.csv_data).toContain('10002');
      expect(jsonResponse.file_export.csv_data).toContain('Reyes, John');
      expect(jsonResponse.file_export.csv_data).toContain('10003');
      expect(jsonResponse.file_export.csv_data).toContain('Cruz, Carlos');
      expect(jsonResponse.file_export.csv_data).not.toContain('10001');

      // Strict zero emojis
      expect(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(jsonResponse.response)).toBe(false);
    });

    it('Admin/Staff: returns all year levels grouped by program when querying "by course or program, all year level tapos may excel"', async () => {
      const mockStudentsList = [
        { id: '1', student_id: '10001', full_name: 'Santos, Maria', program: 'BSIT', year_level: 1, status: 'Active' },
        { id: '2', student_id: '10002', full_name: 'Reyes, John', program: 'BSIT', year_level: 2, status: 'Active' },
        { id: '3', student_id: '10003', full_name: 'Cruz, Carlos', program: 'BSCS', year_level: 2, status: 'Active' },
        { id: '4', student_id: '10004', full_name: 'Lim, Anna', program: 'BSHM', year_level: 3, status: 'Active' },
        { id: '5', student_id: '10005', full_name: 'Tan, David', program: 'BSIT', year_level: 4, status: 'Active' }
      ];

      const mockSupabase = {
        from: (table) => ({
          select: () => {
            const builder = {
              data: mockStudentsList,
              order: () => builder,
              limit: () => ({ data: [] }),
              or: () => ({ limit: () => ({ data: [] }) }),
              ilike: () => ({ limit: () => ({ data: [] }) }),
              eq: () => ({ limit: () => ({ data: [] }), order: () => ({ data: [] }) })
            };
            return builder;
          },
          insert: () => ({ data: [] })
        })
      };

      let jsonResponse = null;
      const req = {
        body: { query: 'gusto ko ipakita din ng chatbot ai ang lahat ng record pag hining by course or program, all year level or 1st year, 2nd ,3rd, 4th only tapos may excel din' },
        user: { id: 'admin-1', role: 'registrar_admin', full_name: 'Registrar Admin' }
      };
      const res = {
        status() { return this; },
        json(data) { jsonResponse = data; return this; }
      };

      await queryChatbot(req, res, mockSupabase);

      expect(jsonResponse).not.toBeNull();
      // Should show matrix / table with degree programs
      expect(jsonResponse.response).toContain('BSIT');
      expect(jsonResponse.response).toContain('BSCS');
      expect(jsonResponse.response).toContain('BSHM');
      expect(jsonResponse.response).toContain('Santos, Maria');
      expect(jsonResponse.response).toContain('Reyes, John');

      // Excel export must be present
      expect(jsonResponse.file_export).not.toBeNull();
      expect(jsonResponse.file_export.format).toBe('excel');
      expect(jsonResponse.file_export.csv_data).toContain('10001');
      expect(jsonResponse.file_export.csv_data).toContain('10005');

      // Strict zero emojis
      expect(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(jsonResponse.response)).toBe(false);
    });

    it('Admin/Staff: returns BSIT Year 1 records only when querying "BSIT 1st year"', async () => {
      const mockStudentsList = [
        { id: '1', student_id: '10001', full_name: 'Santos, Maria', program: 'BSIT', year_level: 1, status: 'Active' },
        { id: '2', student_id: '10002', full_name: 'Reyes, John', program: 'BSIT', year_level: 2, status: 'Active' },
        { id: '3', student_id: '10003', full_name: 'Cruz, Carlos', program: 'BSCS', year_level: 1, status: 'Active' },
        { id: '4', student_id: '10004', full_name: 'Lim, Anna', program: 'BSHM', year_level: 1, status: 'Active' }
      ];

      const mockSupabase = {
        from: (table) => ({
          select: () => {
            const builder = {
              data: mockStudentsList,
              order: () => builder,
              limit: () => ({ data: [] }),
              or: () => ({ limit: () => ({ data: [] }) }),
              ilike: () => ({ limit: () => ({ data: [] }) }),
              eq: () => ({ limit: () => ({ data: [] }), order: () => ({ data: [] }) })
            };
            return builder;
          },
          insert: () => ({ data: [] })
        })
      };

      let jsonResponse = null;
      const req = {
        body: { query: 'BSIT 1st year' },
        user: { id: 'admin-1', role: 'registrar_admin', full_name: 'Registrar Admin' }
      };
      const res = {
        status() { return this; },
        json(data) { jsonResponse = data; return this; }
      };

      await queryChatbot(req, res, mockSupabase);

      expect(jsonResponse).not.toBeNull();
      expect(jsonResponse.response).toContain('BSIT');
      expect(jsonResponse.response).toContain('Santos, Maria');
      // Should not contain BSCS or BSHM or BSIT 2nd year
      expect(jsonResponse.response).not.toContain('Cruz, Carlos');
      expect(jsonResponse.response).not.toContain('Lim, Anna');
      expect(jsonResponse.response).not.toContain('Reyes, John');

      // Excel export must be present
      expect(jsonResponse.file_export).not.toBeNull();
      expect(jsonResponse.file_export.csv_data).toContain('10001');
      expect(jsonResponse.file_export.csv_data).not.toContain('10002');
      expect(jsonResponse.file_export.csv_data).not.toContain('10003');

      // Strict zero emojis
      expect(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(jsonResponse.response)).toBe(false);
    });

    it('isCohortDetailsComplete identifies complete vs incomplete queries', () => {
      // Directory is always complete
      expect(isCohortDetailsComplete({ isCohortQuery: true, cohortType: 'directory', program: 'BSIT', yearLevel: null })).toBe(true);

      // Grades: requires both program and year level
      expect(isCohortDetailsComplete({ isCohortQuery: true, cohortType: 'grades', program: 'BSIT', yearLevel: 2 })).toBe(true);
      expect(isCohortDetailsComplete({ isCohortQuery: true, cohortType: 'grades', program: 'BSIT', yearLevel: null })).toBe(false);
      expect(isCohortDetailsComplete({ isCohortQuery: true, cohortType: 'grades', program: null, yearLevel: 2 })).toBe(false);
      expect(isCohortDetailsComplete({ isCohortQuery: true, cohortType: 'grades', program: null, yearLevel: null })).toBe(false);

      // Recommendation: requires both program and year level
      expect(isCohortDetailsComplete({ isCohortQuery: true, cohortType: 'recommendation', program: 'BSIT', yearLevel: 1 })).toBe(true);
      expect(isCohortDetailsComplete({ isCohortQuery: true, cohortType: 'recommendation', program: 'BSIT', yearLevel: null })).toBe(false);
      expect(isCohortDetailsComplete({ isCohortQuery: true, cohortType: 'recommendation', program: null, yearLevel: 1 })).toBe(false);
    });

    it('Admin/Staff: returns clarifying follow-up question when asking for grades without year level', async () => {
      const mockSupabase = {
        from: () => ({
          select: () => ({
            data: [],
            order: () => ({ data: [] }),
            limit: () => ({ data: [] }),
            or: () => ({ limit: () => ({ data: [] }) }),
            ilike: () => ({ limit: () => ({ data: [] }) }),
            eq: () => ({ limit: () => ({ data: [] }), order: () => ({ data: [] }) })
          }),
          insert: () => ({ data: [] })
        })
      };

      let jsonResponse = null;
      const req = {
        body: { query: 'records ng grades ng BSIT' },
        user: { id: 'admin-1', role: 'registrar_admin', full_name: 'Registrar Admin' }
      };
      const res = {
        status() { return this; },
        json(data) { jsonResponse = data; return this; }
      };

      await queryChatbot(req, res, mockSupabase);

      expect(jsonResponse).not.toBeNull();
      // Must ask clarifying question about year level
      expect(jsonResponse.response).toContain('BSIT');
      expect(jsonResponse.response).toContain('year level');
      expect(jsonResponse.response).toContain('1st Year');
      expect(jsonResponse.response).toContain('2nd Year');
      // No file export until detail is complete
      expect(jsonResponse.file_export).toBeNull();
      // student_action must record pending_action: clarify_cohort_details
      expect(jsonResponse.student_action).not.toBeNull();
      expect(jsonResponse.student_action.pending_action).toBe('clarify_cohort_details');
      expect(jsonResponse.student_action.program).toBe('BSIT');
      // Zero emojis
      expect(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(jsonResponse.response)).toBe(false);
    });

    it('Admin/Staff: continues across turns when user answers follow-up with "2nd year"', async () => {
      const mockGradeRecords = [
        { student_id: '10002', full_name: 'Reyes, John', course: 'BSIT', year_level: 2, subject: 'IT201', units: 3, grade: 1.5, semester: '1st Sem', academic_year: '2025-2026', status: 'passed' },
        { student_id: '10002', full_name: 'Reyes, John', course: 'BSIT', year_level: 2, subject: 'IT202', units: 3, grade: 1.75, semester: '1st Sem', academic_year: '2025-2026', status: 'passed' }
      ];

      const mockSupabase = {
        from: (table) => ({
          select: () => {
            const builder = {
              data: table === 'grade_records' ? mockGradeRecords : [],
              order: () => builder,
              limit: () => ({ data: [] }),
              or: () => ({ limit: () => ({ data: [] }) }),
              ilike: () => ({ limit: () => ({ data: [] }) }),
              eq: () => builder
            };
            return builder;
          },
          insert: () => ({ data: [] })
        })
      };

      let jsonResponse = null;
      const req = {
        body: {
          query: '2nd year',
          history: [
            { sender: 'user', role: 'user', content: 'records ng grades ng BSIT' },
            {
              sender: 'bot',
              role: 'assistant',
              content: 'Para sa programang BSIT, aling year level ang nais ninyong makita ang talaan ng mga marka?',
              student_action: {
                pending_action: 'clarify_cohort_details',
                cohort_type: 'grades',
                program: 'BSIT'
              }
            }
          ]
        },
        user: { id: 'admin-1', role: 'registrar_admin', full_name: 'Registrar Admin' }
      };
      const res = {
        status() { return this; },
        json(data) { jsonResponse = data; return this; }
      };

      await queryChatbot(req, res, mockSupabase);

      expect(jsonResponse).not.toBeNull();
      // Should now produce grade records report for BSIT 2nd Year
      expect(jsonResponse.response).toContain('BSIT');
      expect(jsonResponse.response).toContain('2nd Year');
      expect(jsonResponse.response).toContain('Reyes, John');
      // Excel export must be present
      expect(jsonResponse.file_export).not.toBeNull();
      expect(jsonResponse.file_export.format).toBe('excel');
      expect(jsonResponse.file_export.filename).toContain('BSIT_2nd_Year');
      expect(jsonResponse.file_export.csv_data).toContain('10002');
      expect(jsonResponse.file_export.csv_data).toContain('IT201');
      // Zero emojis
      expect(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(jsonResponse.response)).toBe(false);
    });

    it('Admin/Staff: returns subject recommendations with Excel file when querying "subject recommendation ng 1st year BSIT"', async () => {
      const mockSubjectsList = [
        { id: 'sub-1', code: 'IT101', title: 'Introduction to Computing', units: 3, lec_units: 2, lab_units: 1, year_level: 1, semester: 1, program: 'BSIT', prerequisites_text: 'None' },
        { id: 'sub-2', code: 'IT102', title: 'Computer Programming 1', units: 3, lec_units: 2, lab_units: 1, year_level: 1, semester: 1, program: 'BSIT', prerequisites_text: 'None' }
      ];

      const mockSupabase = {
        from: (table) => ({
          select: () => {
            const builder = {
              data: table === 'subjects' ? mockSubjectsList : [],
              order: () => builder,
              limit: () => ({ data: [] }),
              or: () => ({ limit: () => ({ data: [] }) }),
              ilike: () => ({ limit: () => ({ data: [] }) }),
              eq: () => builder
            };
            return builder;
          },
          insert: () => ({ data: [] })
        })
      };

      let jsonResponse = null;
      const req = {
        body: { query: 'subject recommendation ng 1st year BSIT tapos may excel din' },
        user: { id: 'admin-1', role: 'registrar_admin', full_name: 'Registrar Admin' }
      };
      const res = {
        status() { return this; },
        json(data) { jsonResponse = data; return this; }
      };

      await queryChatbot(req, res, mockSupabase);

      expect(jsonResponse).not.toBeNull();
      expect(jsonResponse.response).toContain('Subject Recommendations');
      expect(jsonResponse.response).toContain('BSIT');
      expect(jsonResponse.response).toContain('IT101');
      expect(jsonResponse.response).toContain('Introduction to Computing');
      expect(jsonResponse.response).toContain('IT102');

      // Excel export must be present
      expect(jsonResponse.file_export).not.toBeNull();
      expect(jsonResponse.file_export.format).toBe('excel');
      expect(jsonResponse.file_export.filename).toContain('Subject_Recommendations_BSIT_1st_Year');
      expect(jsonResponse.file_export.csv_data).toContain('IT101');
      expect(jsonResponse.file_export.csv_data).toContain('Introduction to Computing');

      // Zero emojis
      expect(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(jsonResponse.response)).toBe(false);
    });
  });
});

