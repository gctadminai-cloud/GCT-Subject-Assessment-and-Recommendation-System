import { describe, it, expect } from 'vitest';
const {
  queryChatbot,
  isTagalogQuery,
  hasRecordForAcademicTerm,
  isEnrollmentEligibilityQuery,
  buildEnrollmentEligibilityResponse
} = require('../controllers/chatbotController');

describe('Enrollment eligibility term checks', () => {
  const activeTerm = { academicYear: '2026-2027', semester: '2' };

  it('recognizes Tagalog questions about enrolling in the next year', () => {
    expect(isEnrollmentEligibilityQuery('Applicable naba akong mag enroll for 3rd year?')).toBe(true);
    expect(isTagalogQuery('Applicable naba akong mag enroll for 3rd year?')).toBe(true);
    expect(isEnrollmentEligibilityQuery('Ano ang schedule ng enrollment?')).toBe(false);
  });

  it('does not treat previous-semester grades as completion of the active semester', () => {
    const records = [{ term: '2026-2027 First Sem', status: 'passed' }];
    expect(hasRecordForAcademicTerm(records, activeTerm.academicYear, activeTerm.semester)).toBe(false);

    const answer = buildEnrollmentEligibilityResponse(
      'Applicable naba akong mag enroll for 3rd year?',
      { year_level: 2 },
      records,
      activeTerm,
      true
    );
    expect(answer).toContain('Hindi pa makukumpirma');
    expect(answer).toContain('2026-2027 2nd semester');
    expect(answer).toContain('wala pang grade record');
    expect(answer).toContain('2026-2027 First Sem');
  });

  it('still requires Registrar confirmation when current-semester grades exist', () => {
    const records = [{ term: '2026-2027 Second Sem', status: 'passed' }];
    expect(hasRecordForAcademicTerm(records, activeTerm.academicYear, activeTerm.semester)).toBe(true);

    const answer = buildEnrollmentEligibilityResponse(
      'Pwede na ba akong mag-enroll sa 3rd year?',
      { year_level: 2 },
      records,
      activeTerm,
      true
    );
    expect(answer).toContain('hindi pa rin sapat');
    expect(answer).toContain('Ipa-verify');
  });
});

function createMockRes() {
  return {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    }
  };
}

describe('GCT AI Chatbot Role-Based Access Control & Record Generation', { timeout: 25000 }, () => {
  it('Guest: blocks confidential student inquiries with login-required warning', async () => {
    const req = {
      body: { query: 'Show me grades of student 10526' },
      user: { id: 'guest', role: 'guest', full_name: 'Visitor' }
    };
    const res = createMockRes();
    await queryChatbot(req, res);

    expect(res.data.response).toContain('Access Restricted');
    expect(res.data.response).toContain('Login Required');
    expect(res.data.file_export).toBeNull();
    expect(res.data.student_action).toBeNull();
  });

  it('Guest: allows general admissions and registration questions', async () => {
    const req = {
      body: { query: 'How do I create a student account?' },
      user: { id: 'guest', role: 'guest', full_name: 'Visitor' }
    };
    const res = createMockRes();
    await queryChatbot(req, res);

    expect(res.data.response).toContain('Create Student Account');
    expect(res.data.file_export).toBeNull();
  });

  it('Student: denies querying records of another student', async () => {
    const req = {
      body: { query: 'Can I see the grades of 10526?' },
      user: { id: '10094', student_id: '10094', role: 'student', full_name: 'CYRA MAE ABAYON' }
    };
    const res = createMockRes();
    await queryChatbot(req, res);

    expect(res.data.response).toContain('Access Denied');
    expect(res.data.response).toContain('Privacy Protection');
    expect(res.data.file_export).toBeNull();
  });

  it('Student: provides own standing and downloadable CSV', async () => {
    const req = {
      body: { query: 'What is my GWA and standing?' },
      user: { id: '10526', student_id: '10526', role: 'student', full_name: 'CHIN-CHIN ABAYON' }
    };
    const res = createMockRes();
    await queryChatbot(req, res);

    expect(res.data.response.toLowerCase()).toContain('chin-chin abayon');
    expect(res.data.file_export).not.toBeNull();
    expect(res.data.file_export.filename).toContain('10526');
  });

  it('Admin/Staff: retrieves specific student record with CSV and action links', async () => {
    const req = {
      body: { query: 'Record of 10094' },
      user: { id: 'admin-1', role: 'registrar_admin', full_name: 'System Administrator' }
    };
    const res = createMockRes();
    await queryChatbot(req, res);

    expect(res.data.response).toContain('10094');
    expect(res.data.file_export).not.toBeNull();
    expect(res.data.file_export.filename).toBe('10094_Academic_Record.csv');
    expect(res.data.student_action).not.toBeNull();
    expect(res.data.student_action.student_id).toBe('10094');
  });

  it('Admin/Staff: generates Microsoft Word document (.doc) when Word format is requested', async () => {
    const req = {
      body: { query: 'Please generate a Word document of student 10094' },
      user: { id: 'admin-1', role: 'registrar_admin', full_name: 'System Administrator' }
    };
    const res = createMockRes();
    await queryChatbot(req, res);

    expect(res.data.file_export).not.toBeNull();
    expect(res.data.file_export.filename).toBe('10094_Academic_Record.doc');
    expect(res.data.file_export.format).toBe('word');
    expect(res.data.file_export.data).toContain('GARCIA COLLEGE OF TECHNOLOGY');
  });

  it('Student: generates Word file when student asks for Word format', async () => {
    const req = {
      body: { query: 'Can you give me a Word doc of my record?' },
      user: { id: '10526', student_id: '10526', role: 'student', full_name: 'CHIN-CHIN ABAYON' }
    };
    const res = createMockRes();
    await queryChatbot(req, res);

    expect(res.data.file_export).not.toBeNull();
    expect(res.data.file_export.filename).toBe('10526_My_Academic_Record.doc');
    expect(res.data.file_export.format).toBe('word');
  });

  it('Scope Guardrail: apologizes and rejects out-of-scope questions (e.g. weather, sports)', async () => {
    const req = {
      body: { query: 'What is the weather today?' },
      user: { id: '10526', student_id: '10526', role: 'student', full_name: 'CHIN-CHIN ABAYON' }
    };
    const res = createMockRes();
    await queryChatbot(req, res);

    expect(res.data.response.toLowerCase()).toContain('outside my scope');
    expect(res.data.response).toContain('Garcia College of Technology');
    expect(res.data.file_export).toBeNull();
  });

  it('Academic Opinion: provides structured advising opinion when student asks for advice or opinion', async () => {
    const req = {
      body: { query: 'Can you give me an opinion on my grades and what I should do?' },
      user: { id: '10526', student_id: '10526', role: 'student', full_name: 'CHIN-CHIN ABAYON' }
    };
    const res = createMockRes();
    await queryChatbot(req, res);

    expect(res.data.response).toContain('Academic Advising Opinion');
    expect(res.data.response).toContain('Strategic Recommendations');
  });

  it('Zero Emojis: ensures chatbot responses contain no decorative emojis', async () => {
    const req = {
      body: { query: 'Hello po' },
      user: { id: 'admin-1', role: 'registrar_admin', full_name: 'System Administrator' }
    };
    const res = createMockRes();
    await queryChatbot(req, res);

    // Verify no emoji unicode ranges exist in response
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1FA00}-\u{1FAFF}🔒👉🎓⛔👋📥✅❌📋⏳👥🔍📊⚙️✨💡]/u;
    expect(emojiRegex.test(res.data.response)).toBe(false);
  });
});
