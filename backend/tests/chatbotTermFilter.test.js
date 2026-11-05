import { describe, it, expect } from 'vitest';
const {
  extractTargetTermAndSemester,
  matchesRecordTerm
} = require('../controllers/chatbotController');

describe('Chatbot Specific Term Filtering Unit Tests', () => {
  describe('extractTargetTermAndSemester', () => {
    it('correctly extracts "2nd year 1st sem" from prompt', () => {
      const result = extractTargetTermAndSemester('give me the record of student ID 12310 for 2nd year 1st sem');
      expect(result.year).toBe(2);
      expect(result.explicitYear).toBe(2);
      expect(result.semester).toBe('1');
      expect(result.target_term).toBe('2nd Year • 1st Sem');
      expect(result.isSpecificFilter).toBe(true);
    });

    it('correctly extracts "1st year 2nd semester"', () => {
      const result = extractTargetTermAndSemester('records of 10526 for 1st year 2nd semester');
      expect(result.year).toBe(1);
      expect(result.explicitYear).toBe(1);
      expect(result.semester).toBe('2');
      expect(result.target_term).toBe('1st Year • 2nd Sem');
      expect(result.isSpecificFilter).toBe(true);
    });

    it('correctly extracts "3rd year summer"', () => {
      const result = extractTargetTermAndSemester('show summer subjects for 3rd year');
      expect(result.year).toBe(3);
      expect(result.explicitYear).toBe(3);
      expect(result.semester).toBe('summer');
      expect(result.isSpecificFilter).toBe(true);
    });

    it('extracts semester only and infers year from student profile when available', () => {
      const result = extractTargetTermAndSemester('give me grades for 2nd sem', 2);
      expect(result.year).toBe(2);
      expect(result.explicitYear).toBeNull();
      expect(result.semester).toBe('2');
      expect(result.target_term).toBe('2nd Year • 2nd Sem');
      expect(result.isSpecificFilter).toBe(true);
    });

    it('returns isSpecificFilter: false for general queries', () => {
      const result = extractTargetTermAndSemester('what is my standing?');
      expect(result.isSpecificFilter).toBe(false);
      expect(result.target_term).toBeNull();
    });
  });

  describe('matchesRecordTerm', () => {
    it('matches record by curriculum year level and semester', () => {
      const rec = {
        code: 'IT 211',
        title: 'Data Structures',
        curriculum_year_level: 2,
        semester: '1',
        term: '2025-2026 1st Sem'
      };
      expect(matchesRecordTerm(rec, 2, '1')).toBe(true);
      expect(matchesRecordTerm(rec, 2, '2')).toBe(false);
      expect(matchesRecordTerm(rec, 1, '1')).toBe(false);
    });

    it('matches record by term text (e.g. 2nd Year 1st Sem)', () => {
      const rec = {
        code: 'IT 212',
        title: 'Object Oriented Programming',
        term: '2nd Year • 1st Sem'
      };
      expect(matchesRecordTerm(rec, 2, '1')).toBe(true);
      expect(matchesRecordTerm(rec, 2, '2')).toBe(false);
    });

    it('matches summer term properly', () => {
      const rec = {
        code: 'IT 331',
        title: 'Practicum',
        curriculum_year_level: 3,
        semester: 'summer',
        term: '2026-2027 Summer'
      };
      expect(matchesRecordTerm(rec, 3, 'summer')).toBe(true);
      expect(matchesRecordTerm(rec, 3, '1')).toBe(false);
    });

    it('filters an array of mixed records returning only the requested 2nd year 1st sem records', () => {
      const allRecords = [
        { code: 'IT 111', curriculum_year_level: 1, semester: '1', term: '1st Year • 1st Sem' },
        { code: 'IT 112', curriculum_year_level: 1, semester: '2', term: '1st Year • 2nd Sem' },
        { code: 'IT 211', curriculum_year_level: 2, semester: '1', term: '2nd Year • 1st Sem' },
        { code: 'IT 212', curriculum_year_level: 2, semester: '1', term: '2nd Year • 1st Sem' },
        { code: 'IT 221', curriculum_year_level: 2, semester: '2', term: '2nd Year • 2nd Sem' },
        { code: 'IT 311', curriculum_year_level: 3, semester: '1', term: '3rd Year • 1st Sem' }
      ];

      const { year, semester } = extractTargetTermAndSemester('give me the record of student ID 12310 for 2nd year 1st sem');
      const filtered = allRecords.filter(r => matchesRecordTerm(r, year, semester));

      expect(filtered.length).toBe(2);
      expect(filtered.map(f => f.code)).toEqual(['IT 211', 'IT 212']);
    });
  });
});
