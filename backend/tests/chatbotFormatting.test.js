import { describe, it, expect } from 'vitest';
const {
  cleanMemorandumFormatting,
  buildGradesTableMarkdown,
  buildRecommendationsTableMarkdown,
  buildDeficienciesTableMarkdown,
  buildStudentsTableMarkdown,
  classifyStudentQueryIntent,
  formatTargetTermText
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
});

