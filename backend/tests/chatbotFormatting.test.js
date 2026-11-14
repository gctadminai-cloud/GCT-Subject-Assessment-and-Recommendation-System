import { describe, it, expect } from 'vitest';
const {
  cleanMemorandumFormatting,
  buildGradesTableMarkdown,
  buildRecommendationsTableMarkdown,
  buildDeficienciesTableMarkdown,
  buildStudentsTableMarkdown,
  classifyStudentQueryIntent,
  formatTargetTermText,
  generateStudentCsv
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
    expect(classifyStudentQueryIntent('Comprehensive assessment of student 12310')).toBe('comprehensive');
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
});

