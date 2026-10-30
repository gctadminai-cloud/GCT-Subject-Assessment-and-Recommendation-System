import type { AcademicGrade, Student, CurriculumSubject, RecommendedSubjectItem } from '../modules/types';

export interface CurriculumSubjectDef {
  code: string;
  title: string;
  units: number;
  yearLevel: number;
  semester: number;
  termName: string;
  isPrereqChallenging?: boolean;
}

export const GCT_CURRICULUM_BSIT: CurriculumSubjectDef[] = [
  // 1st Year • 1st Semester (9 subjects - 23 units)
  { code: 'C.O. 1', title: 'College Orientation 1', units: 1, yearLevel: 1, semester: 1, termName: '1st Year • 1st Sem' },
  { code: 'UTS 1', title: 'Understanding the Self', units: 3, yearLevel: 1, semester: 1, termName: '1st Year • 1st Sem' },
  { code: 'Histo 1', title: 'Readings in Philippine History', units: 3, yearLevel: 1, semester: 1, termName: '1st Year • 1st Sem' },
  { code: 'Engl 1', title: 'Purposive Communication', units: 3, yearLevel: 1, semester: 1, termName: '1st Year • 1st Sem' },
  { code: 'Math 1', title: 'Mathematics in the Modern World', units: 3, yearLevel: 1, semester: 1, termName: '1st Year • 1st Sem', isPrereqChallenging: true },
  { code: 'CC 101', title: 'Introduction to Computing', units: 3, yearLevel: 1, semester: 1, termName: '1st Year • 1st Sem' },
  { code: 'CC 102', title: 'Computer Programming 1 (Fundamentals of Programming)', units: 3, yearLevel: 1, semester: 1, termName: '1st Year • 1st Sem' },
  { code: 'PE 1', title: 'Physical Activities Toward Health and Fitness 1 (PATHFit 1): Movement Competency Training', units: 2, yearLevel: 1, semester: 1, termName: '1st Year • 1st Sem' },
  { code: 'NSTP 1', title: 'National Service Training Program 1', units: 3, yearLevel: 1, semester: 1, termName: '1st Year • 1st Sem' },

  // 1st Year • 2nd Semester (8 subjects - 22 units)
  { code: 'CC 103', title: 'Computer Programming 2 (Intermediate Programming)', units: 3, yearLevel: 1, semester: 2, termName: '1st Year • 2nd Sem' },
  { code: 'CC 104', title: 'Application Development & Emerging Technologies', units: 3, yearLevel: 1, semester: 2, termName: '1st Year • 2nd Sem' },
  { code: 'CW 1', title: 'The Contemporary World', units: 3, yearLevel: 1, semester: 2, termName: '1st Year • 2nd Sem' },
  { code: 'Hum 1', title: 'Art Appreciation', units: 3, yearLevel: 1, semester: 2, termName: '1st Year • 2nd Sem' },
  { code: 'STS 1', title: 'Science, Technology and Society', units: 3, yearLevel: 1, semester: 2, termName: '1st Year • 2nd Sem' },
  { code: 'Hum 2', title: 'Philosophy / Humanities 2', units: 3, yearLevel: 1, semester: 2, termName: '1st Year • 2nd Sem' },
  { code: 'PE 2', title: 'Physical Activities Toward Health and Fitness 2 (PATHFit 2): Exercise-Based Fitness Activities', units: 2, yearLevel: 1, semester: 2, termName: '1st Year • 2nd Sem' },
  { code: 'NSTP 2', title: 'National Service Training Program 2', units: 3, yearLevel: 1, semester: 2, termName: '1st Year • 2nd Sem' },

  // 2nd Year • 1st Semester (9 subjects - 26 units)
  { code: 'CC 105', title: 'Data Structures and Algorithms', units: 3, yearLevel: 2, semester: 1, termName: '2nd Year • 1st Sem' },
  { code: 'CC 106', title: 'Information Management 1', units: 3, yearLevel: 2, semester: 1, termName: '2nd Year • 1st Sem' },
  { code: 'IT 1', title: 'Fundamentals of Database Systems', units: 3, yearLevel: 2, semester: 1, termName: '2nd Year • 1st Sem' },
  { code: 'IT 2', title: 'System Analysis & Design', units: 3, yearLevel: 2, semester: 1, termName: '2nd Year • 1st Sem' },
  { code: 'IT 3', title: 'Networking 1', units: 3, yearLevel: 2, semester: 1, termName: '2nd Year • 1st Sem', isPrereqChallenging: true },
  { code: 'Fili 1', title: 'Kontikstwalisadong Komunikasyon sa Wikang Filipino', units: 3, yearLevel: 2, semester: 1, termName: '2nd Year • 1st Sem' },
  { code: 'Ethics 1', title: 'Ethics', units: 3, yearLevel: 2, semester: 1, termName: '2nd Year • 1st Sem' },
  { code: 'STS 2', title: 'Environmental Science', units: 3, yearLevel: 2, semester: 1, termName: '2nd Year • 1st Sem' },
  { code: 'PE 3', title: 'Physical Activities Toward Health and Fitness 3 (PATHFit 3): Dance', units: 2, yearLevel: 2, semester: 1, termName: '2nd Year • 1st Sem' },

  // 2nd Year • 2nd Semester (9 subjects - 24 units)
  { code: 'IT 4', title: 'Information Management 2', units: 3, yearLevel: 2, semester: 2, termName: '2nd Year • 2nd Sem' },
  { code: 'IT 5', title: 'Information Assurance and Security 1', units: 3, yearLevel: 2, semester: 2, termName: '2nd Year • 2nd Sem' },
  { code: 'IT 6', title: 'System Integration and Architecture 1', units: 3, yearLevel: 2, semester: 2, termName: '2nd Year • 2nd Sem' },
  { code: 'IT 7', title: 'Discrete Mathematics', units: 3, yearLevel: 2, semester: 2, termName: '2nd Year • 2nd Sem', isPrereqChallenging: true },
  { code: 'IT 8', title: 'Networking 2', units: 2, yearLevel: 2, semester: 2, termName: '2nd Year • 2nd Sem' },
  { code: 'Fili 2', title: "Filipino sa Iba't ibang Disiplina", units: 3, yearLevel: 2, semester: 2, termName: '2nd Year • 2nd Sem' },
  { code: 'Rizal 1', title: 'Life and Works of Jose Rizal', units: 3, yearLevel: 2, semester: 2, termName: '2nd Year • 2nd Sem' },
  { code: 'Ttrep 1', title: 'Technopreneurship', units: 3, yearLevel: 2, semester: 2, termName: '2nd Year • 2nd Sem' },
  { code: 'PE 4', title: 'Physical Activities Toward Health and Fitness 4 (PATHFit 4): Sports', units: 2, yearLevel: 2, semester: 2, termName: '2nd Year • 2nd Sem' },

  // 3rd Year • 1st Semester (7 subjects - 21 units)
  { code: 'IT 9', title: 'Information Assurance and Security 2', units: 3, yearLevel: 3, semester: 1, termName: '3rd Year • 1st Sem' },
  { code: 'IT 10', title: 'System Integration and Architecture 2', units: 3, yearLevel: 3, semester: 1, termName: '3rd Year • 1st Sem' },
  { code: 'IT 11', title: 'Web Systems and Technologies 1', units: 3, yearLevel: 3, semester: 1, termName: '3rd Year • 1st Sem' },
  { code: 'IT 12', title: 'Application Development 1', units: 3, yearLevel: 3, semester: 1, termName: '3rd Year • 1st Sem' },
  { code: 'IT 13', title: 'Human Computer Interaction 1', units: 3, yearLevel: 3, semester: 1, termName: '3rd Year • 1st Sem' },
  { code: 'IT 14', title: 'System Administration and Maintenance', units: 3, yearLevel: 3, semester: 1, termName: '3rd Year • 1st Sem' },
  { code: 'Math 4', title: 'Statistical Analysis', units: 3, yearLevel: 3, semester: 1, termName: '3rd Year • 1st Sem' },

  // 3rd Year • 2nd Semester (7 subjects - 21 units)
  { code: 'IT 15', title: 'IT Audit & Controls', units: 3, yearLevel: 3, semester: 2, termName: '3rd Year • 2nd Sem' },
  { code: 'IT 16', title: 'Social and Professional Issues', units: 3, yearLevel: 3, semester: 2, termName: '3rd Year • 2nd Sem' },
  { code: 'IT 17', title: 'Application Development 2', units: 3, yearLevel: 3, semester: 2, termName: '3rd Year • 2nd Sem' },
  { code: 'IT 18', title: 'Quantitative Method', units: 3, yearLevel: 3, semester: 2, termName: '3rd Year • 2nd Sem' },
  { code: 'IT 19', title: 'Integrative Programming and Technologies 1', units: 3, yearLevel: 3, semester: 2, termName: '3rd Year • 2nd Sem' },
  { code: 'IT E1', title: 'Object-Oriented Programming', units: 3, yearLevel: 3, semester: 2, termName: '3rd Year • 2nd Sem' },
  { code: 'SocSci 1', title: 'Philippine Government & New Constitution', units: 3, yearLevel: 3, semester: 2, termName: '3rd Year • 2nd Sem' },

  // 3rd Year • Summer Term (2 subjects - 6 units)
  { code: 'CP 1', title: 'Capstone Project 1', units: 3, yearLevel: 3, semester: 3, termName: '3rd Year • Summer' },
  { code: 'IT E2', title: 'Web Systems and Technologies 2', units: 3, yearLevel: 3, semester: 3, termName: '3rd Year • Summer' },

  // 4th Year • 1st Semester (3 subjects - 9 units)
  { code: 'CP 2', title: 'Capstone Project 2', units: 3, yearLevel: 4, semester: 1, termName: '4th Year • 1st Sem' },
  { code: 'IT E3', title: 'Human Computer Interaction 2', units: 3, yearLevel: 4, semester: 1, termName: '4th Year • 1st Sem' },
  { code: 'IT E4', title: 'Integrative Programming and Technologies 2', units: 3, yearLevel: 4, semester: 1, termName: '4th Year • 1st Sem' },

  // 4th Year • 2nd Semester (2 subjects - 8 units)
  { code: 'IT E5', title: 'Platform Technologies', units: 3, yearLevel: 4, semester: 2, termName: '4th Year • 2nd Sem' },
  { code: 'OJT-IT', title: 'On-The-Job Training (Minimum of 486 hours)', units: 5, yearLevel: 4, semester: 2, termName: '4th Year • 2nd Sem' }
];

export const GCT_CURRICULUM_BSCS: CurriculumSubjectDef[] = [
  // 1st Year • 1st Semester (9 subjects - 23 units)
  { code: 'C.O. 1', title: 'College Orientation 1', units: 1, yearLevel: 1, semester: 1, termName: '1st Year • 1st Sem' },
  { code: 'UTS 1', title: 'Understanding the Self', units: 3, yearLevel: 1, semester: 1, termName: '1st Year • 1st Sem' },
  { code: 'Histo 1', title: 'Readings in Philippine History', units: 3, yearLevel: 1, semester: 1, termName: '1st Year • 1st Sem' },
  { code: 'Engl 1', title: 'Purposive Communication', units: 3, yearLevel: 1, semester: 1, termName: '1st Year • 1st Sem' },
  { code: 'Math 1 CS', title: 'Mathematics in the Modern World', units: 3, yearLevel: 1, semester: 1, termName: '1st Year • 1st Sem', isPrereqChallenging: true },
  { code: 'CC 101', title: 'Introduction to Computing', units: 3, yearLevel: 1, semester: 1, termName: '1st Year • 1st Sem' },
  { code: 'CC 102', title: 'Computer Programming 1 (Fundamentals of Programming)', units: 3, yearLevel: 1, semester: 1, termName: '1st Year • 1st Sem' },
  { code: 'PE 1', title: 'Physical Activities Toward Health and Fitness 1 (PATHFit 1): Movement Competency Training', units: 2, yearLevel: 1, semester: 1, termName: '1st Year • 1st Sem' },
  { code: 'NSTP 1', title: 'National Service Training Program 1', units: 3, yearLevel: 1, semester: 1, termName: '1st Year • 1st Sem' },

  // 1st Year • 2nd Semester (8 subjects - 23 units)
  { code: 'CC 103', title: 'Computer Programming 2 (Intermediate Programming)', units: 3, yearLevel: 1, semester: 2, termName: '1st Year • 2nd Sem' },
  { code: 'CC 104', title: 'Application Development & Emerging Technologies', units: 3, yearLevel: 1, semester: 2, termName: '1st Year • 2nd Sem' },
  { code: 'CS 01', title: 'Program Enhancement 1 (Logic Switching Design)', units: 3, yearLevel: 1, semester: 2, termName: '1st Year • 2nd Sem' },
  { code: 'CW 1', title: 'The Contemporary World', units: 3, yearLevel: 1, semester: 2, termName: '1st Year • 2nd Sem' },
  { code: 'Hum 1', title: 'Art Appreciation', units: 3, yearLevel: 1, semester: 2, termName: '1st Year • 2nd Sem' },
  { code: 'STS 1', title: 'Science, Technology and Society', units: 3, yearLevel: 1, semester: 2, termName: '1st Year • 2nd Sem' },
  { code: 'PE 2', title: 'Physical Activities Toward Health and Fitness 2 (PATHFit 2): Exercise-Based Fitness Activities', units: 2, yearLevel: 1, semester: 2, termName: '1st Year • 2nd Sem' },
  { code: 'NSTP 2', title: 'National Service Training Program 2', units: 3, yearLevel: 1, semester: 2, termName: '1st Year • 2nd Sem' },

  // 2nd Year • 1st Semester (9 subjects)
  { code: 'CC 105', title: 'Data Structures and Algorithms', units: 3, yearLevel: 2, semester: 1, termName: '2nd Year • 1st Sem' },
  { code: 'CC 106', title: 'Information Management 1', units: 3, yearLevel: 2, semester: 1, termName: '2nd Year • 1st Sem' },
  { code: 'CS 1', title: 'Discrete Structure 1', units: 3, yearLevel: 2, semester: 1, termName: '2nd Year • 1st Sem', isPrereqChallenging: true },
  { code: 'CS 2', title: 'Networks and Communications', units: 3, yearLevel: 2, semester: 1, termName: '2nd Year • 1st Sem' },
  { code: 'CS E1', title: 'System Fundamentals', units: 3, yearLevel: 2, semester: 1, termName: '2nd Year • 1st Sem' },
  { code: 'Fili 1', title: 'Kontikstwalisadong Komunikasyon sa Wikang Filipino', units: 3, yearLevel: 2, semester: 1, termName: '2nd Year • 1st Sem' },
  { code: 'Ethics 1', title: 'Ethics', units: 3, yearLevel: 2, semester: 1, termName: '2nd Year • 1st Sem' },
  { code: 'STS 2', title: 'Environmental Science', units: 3, yearLevel: 2, semester: 1, termName: '2nd Year • 1st Sem' },
  { code: 'PE 3', title: 'Physical Activities Toward Health and Fitness 3 (PATHFit 3): Dance', units: 2, yearLevel: 2, semester: 1, termName: '2nd Year • 1st Sem' },

  // 2nd Year • 2nd Semester (9 subjects)
  { code: 'CS 3', title: 'Architecture and Organization', units: 3, yearLevel: 2, semester: 2, termName: '2nd Year • 2nd Sem' },
  { code: 'CS 4', title: 'Discrete Structure 2', units: 3, yearLevel: 2, semester: 2, termName: '2nd Year • 2nd Sem' },
  { code: 'CS 5', title: 'Operating Systems', units: 3, yearLevel: 2, semester: 2, termName: '2nd Year • 2nd Sem' },
  { code: 'CS 6', title: 'Discrete Mathematics', units: 3, yearLevel: 2, semester: 2, termName: '2nd Year • 2nd Sem', isPrereqChallenging: true },
  { code: 'CS 7', title: 'Information Assurance and Security', units: 3, yearLevel: 2, semester: 2, termName: '2nd Year • 2nd Sem' },
  { code: 'Fili 2', title: "Filipino sa Iba't ibang Disiplina", units: 3, yearLevel: 2, semester: 2, termName: '2nd Year • 2nd Sem' },
  { code: 'Rizal 1', title: 'Life and Works of Jose Rizal', units: 3, yearLevel: 2, semester: 2, termName: '2nd Year • 2nd Sem' },
  { code: 'Ttrep 1', title: 'Technopreneurship', units: 3, yearLevel: 2, semester: 2, termName: '2nd Year • 2nd Sem' },
  { code: 'PE 4', title: 'Physical Activities Toward Health and Fitness 4 (PATHFit 4): Sports', units: 2, yearLevel: 2, semester: 2, termName: '2nd Year • 2nd Sem' },

  // 3rd Year • 1st Semester (7 subjects)
  { code: 'CS 8', title: 'Application Development 1', units: 3, yearLevel: 3, semester: 1, termName: '3rd Year • 1st Sem' },
  { code: 'CS 9', title: 'Human Computer Interaction', units: 3, yearLevel: 3, semester: 1, termName: '3rd Year • 1st Sem' },
  { code: 'CS 10', title: 'Algorithms and Complexity', units: 3, yearLevel: 3, semester: 1, termName: '3rd Year • 1st Sem' },
  { code: 'CS 11', title: 'Software Engineering 1', units: 3, yearLevel: 3, semester: 1, termName: '3rd Year • 1st Sem' },
  { code: 'CS 12', title: 'Programming Languages', units: 3, yearLevel: 3, semester: 1, termName: '3rd Year • 1st Sem' },
  { code: 'CS E2', title: 'Parallel and Distributed Computing', units: 3, yearLevel: 3, semester: 1, termName: '3rd Year • 1st Sem' },
  { code: 'Math 4', title: 'Statistical Analysis', units: 3, yearLevel: 3, semester: 1, termName: '3rd Year • 1st Sem' },

  // 3rd Year • 2nd Semester (7 subjects)
  { code: 'CS 13', title: 'Object-Oriented Programming', units: 3, yearLevel: 3, semester: 2, termName: '3rd Year • 2nd Sem' },
  { code: 'CS 14', title: 'Social and Professional Issues', units: 3, yearLevel: 3, semester: 2, termName: '3rd Year • 2nd Sem' },
  { code: 'CS 15', title: 'Quantitative Method', units: 3, yearLevel: 3, semester: 2, termName: '3rd Year • 2nd Sem' },
  { code: 'CS 16', title: 'IT Audit & Controls', units: 3, yearLevel: 3, semester: 2, termName: '3rd Year • 2nd Sem' },
  { code: 'CS 17', title: 'Automata Theory and Formal Languages', units: 3, yearLevel: 3, semester: 2, termName: '3rd Year • 2nd Sem' },
  { code: 'CS 18', title: 'Application Development 2', units: 3, yearLevel: 3, semester: 2, termName: '3rd Year • 2nd Sem' },
  { code: 'SocSci 1', title: 'Philippine Government & New Constitution', units: 3, yearLevel: 3, semester: 2, termName: '3rd Year • 2nd Sem' },

  // 3rd Year • Summer Term (2 subjects - 6 units)
  { code: 'THS 1', title: 'Thesis Writing 1', units: 3, yearLevel: 3, semester: 3, termName: '3rd Year • Summer' },
  { code: 'CS E3', title: 'Graphics and Visual Computing', units: 3, yearLevel: 3, semester: 3, termName: '3rd Year • Summer' },

  // 4th Year • 1st Semester (4 subjects - 12 units)
  { code: 'CS 19', title: 'Software Engineering 2', units: 3, yearLevel: 4, semester: 1, termName: '4th Year • 1st Sem' },
  { code: 'CS E4', title: 'Computational Science', units: 3, yearLevel: 4, semester: 1, termName: '4th Year • 1st Sem' },
  { code: 'THS 2', title: 'Thesis Writing 2', units: 3, yearLevel: 4, semester: 1, termName: '4th Year • 1st Sem' },

  // 4th Year • 2nd Semester (2 subjects)
  { code: 'CS E5', title: 'Intelligent Systems', units: 3, yearLevel: 4, semester: 2, termName: '4th Year • 2nd Sem' },
  { code: 'OJT-CS', title: 'On-The-Job Training (Minimum of 162 hours)', units: 3, yearLevel: 4, semester: 2, termName: '4th Year • 2nd Sem' }
];

/**
 * Parse a grade record's term/year/semester into a numeric sortable rank.
 * Higher number = more recent (newer) academic term.
 */
export function gradeRecencyRank(rec: {
  term?: string;
  academicYear?: string;
  academic_year?: string;
  semester?: number | string;
  yearLevel?: number;
  year_level?: number;
  createdAt?: string;
  created_at?: string;
}): { yearStart: number; semRank: number; created: number } {
  const term = String(rec.term || rec.academicYear || rec.academic_year || '').trim();
  const sem = String(rec.semester || '');
  const yearMatch = term.match(/(\d{4})/);
  let yearStart = yearMatch ? parseInt(yearMatch[0], 10) : 0;
  if (!yearStart) {
    const yl = Number(rec.yearLevel || rec.year_level || 0);
    if (yl) yearStart = 2024 - (5 - yl);
  }
  let semRank = 1;
  if (/2nd|second|sem 2|sem2|^2$/i.test(term) || /2nd|second|^2$/i.test(sem)) semRank = 2;
  if (/summer/i.test(term) || /summer|^3$/i.test(sem)) semRank = 3;
  const created = rec.createdAt || rec.created_at
    ? new Date((rec.createdAt || rec.created_at) as string).getTime()
    : 0;
  return { yearStart, semRank, created };
}

/**
 * Sort an array of grade attempts CHRONOLOGICALLY NEWEST FIRST.
 * (Newest academic year + semester comes first, then by created date.)
 * Use this before picking "latest attempt" or "best (passed) status wins".
 */
export function sortGradeAttemptsNewestFirst<T>(grades: T[]): T[] {
  return [...grades].sort((a, b) => {
    const ra = gradeRecencyRank(a as any);
    const rb = gradeRecencyRank(b as any);
    if (rb.yearStart !== ra.yearStart) return rb.yearStart - ra.yearStart;
    if (rb.semRank !== ra.semRank) return rb.semRank - ra.semRank;
    return rb.created - ra.created;
  });
}

/**
 * Sort academic term labels chronologically (OLDEST first)
 */
export function sortTermsChronologically(terms: string[]): string[] {
  return [...terms].sort((a, b) => {
    const yearMatchA = a.match(/\d{4}/);
    const yearMatchB = b.match(/\d{4}/);
    const yA = yearMatchA ? parseInt(yearMatchA[0], 10) : 0;
    const yB = yearMatchB ? parseInt(yearMatchB[0], 10) : 0;
    if (yA !== yB) return yA - yB;

    const isSem1A = a.toLowerCase().includes('1st') || a.toLowerCase().includes('first');
    const isSem2A = a.toLowerCase().includes('2nd') || a.toLowerCase().includes('second');
    const isSem1B = b.toLowerCase().includes('1st') || b.toLowerCase().includes('first');
    const isSem2B = b.toLowerCase().includes('2nd') || b.toLowerCase().includes('second');

    const rankA = isSem1A ? 1 : isSem2A ? 2 : 3;
    const rankB = isSem1B ? 1 : isSem2B ? 2 : 3;
    return rankA - rankB;
  });
}

/**
 * Normalizes subject code for consistent matching (e.g. "CC 101" vs "cc101")
 */
export function normalizeSubjCode(code: string): string {
  if (!code) return '';
  const clean = code.toLowerCase().replace(/[^a-z0-9]/g, '');
  const aliases: Record<string, string> = {
    'math1it': 'math1', 'math1cs': 'math1', 'mathematicsinthemodernworld': 'math1',
    'mathinthemodernworld': 'math1', 'modernmathematics': 'math1',
    'co': 'co1', 'co1': 'co1', 'collegeorientation': 'co1', 'collegeorientation1': 'co1',
    'pe1': 'pe1', 'pathfit1': 'pe1', 'physicaleducation1': 'pe1',
    'pe2': 'pe2', 'pathfit2': 'pe2', 'physicaleducation2': 'pe2',
    'pe3': 'pe3', 'pathfit3': 'pe3', 'physicaleducation3': 'pe3',
    'pe4': 'pe4', 'pathfit4': 'pe4', 'physicaleducation4': 'pe4',
    'history1': 'histo1', 'readingsinphilippinehistory': 'histo1', 'philippinehistory': 'histo1',
    'english1': 'engl1', 'purposivecommunication': 'engl1', 'english': 'engl1',
    'understandingtheself': 'uts1',
    'introductiontocomputing': 'cc101', 'introcomputing': 'cc101',
    'fundamentalsofprogramming': 'cc102', 'computerprogramming1': 'cc102', 'prog1': 'cc102',
    'computerprogramming2': 'cc103', 'intermediateprogramming': 'cc103', 'prog2': 'cc103',
    'applicationdevelopmentemergingtechnologies': 'cc104', 'appdev': 'cc104',
    'datastructuresandalgorithms': 'cc105', 'datastructures': 'cc105',
    'informationmanagement1': 'cc106', 'informationmanagement': 'cc106',
    'informationmanagement2': 'it4',
    'environmentalscience': 'sts2',
    'sciencetechnologyandsociety': 'sts1',
    'thecontemporaryworld': 'cw1', 'contemporaryworld': 'cw1',
    'artappreciation': 'hum1',
    'philosophyhumanities2': 'hum2', 'philosophy': 'hum2',
    'nationalservicetrainingprogram1': 'nstp1', 'cwts1': 'nstp1', 'rotc1': 'nstp1',
    'nationalservicetrainingprogram2': 'nstp2', 'cwts2': 'nstp2', 'rotc2': 'nstp2',
    'technopreneurship': 'ttrep1',
    'networking1': 'it3', 'networking2': 'it8',
    'discretemathematics': 'it7', 'discretestructures': 'it7',
    'linearalgebra': 'math4', 'linearalgebraandprobability': 'math4',
    'thesiswriting1': 'ths1', 'thesiswriting2': 'ths2',
    'capstoneproject1': 'cp1', 'capstoneproject2': 'cp2', 'capstone1': 'cp1', 'capstone2': 'cp2',
    'onthejobtraining': 'ojtit', 'onthejobtrainingit': 'ojtit', 'onthejobtrainingcs': 'ojtcs',
    'ethics': 'ethics1', 'ethics1': 'ethics1',
    'filipino1': 'fili1', 'kontekstwalisadongkomunikasyonsafilipino': 'fili1',
    'filipino2': 'fili2', 'filipinosaibatibangdisiplina': 'fili2'
  };
  if (aliases[clean]) return aliases[clean];
  if (clean.includes('mathematicsinthemodernworld') || clean.includes('mathinthemodernworld')) return 'math1';
  if (clean.includes('collegeorientation')) return 'co1';
  if (clean.includes('purposivecommunication')) return 'engl1';
  if (clean.includes('pathfit1') || clean.includes('movementcompetency')) return 'pe1';
  if (clean.includes('pathfit2') || clean.includes('exercisebased')) return 'pe2';
  if (clean.includes('pathfit3')) return 'pe3';
  if (clean.includes('pathfit4')) return 'pe4';
  if (clean.startsWith('rizal')) return 'rizal1';
  if (clean.startsWith('ojt')) return clean.includes('cs') ? 'ojtcs' : 'ojtit';
  return clean;
}

/**
 * Checks if a subject is a Major / Professional Subject in BSIT or BSCS.
 * Major subjects:
 * - CC: Common Computing (CC 101 - CC 106)
 * - IT: Professional IT courses (IT 1 - IT 19, IT E1 - IT E5)
 * - CS: Professional CS courses (CS 1 - CS 19, CS E1 - CS E5)
 * GE courses (PE, NSTP, Hist, Math 1, CW, Hum, STS, Fili, Rizal, Ethics, SocSci, C.O.) are not major subjects.
 */
export function isMajorSubject(code: string, program: string = 'BSIT'): boolean {
  if (!code) return false;
  const norm = normalizeSubjCode(code);
  const prog = (program || 'BSIT').toUpperCase();
  if (norm.startsWith('cc')) return true;
  if (prog === 'BSCS') {
    return norm.startsWith('cs');
  }
  return norm.startsWith('it');
}

/**
 * Checks if a subject is Capstone (CP 1, CP 2, THS 1, THS 2)
 */
export function isCapstoneSubject(code: string): boolean {
  if (!code) return false;
  const norm = normalizeSubjCode(code);
  return (
    norm === 'cp1' ||
    norm === 'cp2' ||
    norm === 'ths1' ||
    norm === 'ths2' ||
    norm.includes('capstone') ||
    norm.includes('thesis')
  );
}

/**
 * Checks if a subject is OJT / Practicum (OJT-IT, OJT-CS)
 */
export function isOjtSubject(code: string): boolean {
  if (!code) return false;
  const norm = normalizeSubjCode(code);
  return (
    norm.startsWith('ojt') ||
    norm.includes('practicum') ||
    norm.includes('internship')
  );
}

/**
 * Builds the STRICT CURRICULUM-BASED academic grade transcript for a student.
 * - Enforces exact curriculum structure (e.g., 1st Year 1st Sem = exactly 9 subjects, 1st Year 2nd Sem = exactly 8 subjects).
 * - Maps directly to real database grade records.
 * - Never fabricates fake or deterministic grades.
 * - Untaken subjects are clearly marked 'not_taken' with grade: null.
 * - Retaken subjects preserve all attempts and highlight the cleared/passed mark.
 */
export function buildCompleteStudentGrades(
  student: Student,
  existingGrades: AcademicGrade[] = []
): AcademicGrade[] {
  if (!student) return [];
  const program = (student.program || (student as any).course || 'BSIT').toUpperCase();
  const curriculumDefs = program === 'BSCS' ? GCT_CURRICULUM_BSCS : GCT_CURRICULUM_BSIT;

  // Group all existing database grade records by normalized code
  const recordsByCode = new Map<string, AcademicGrade[]>();
  existingGrades.forEach(g => {
    const codeKey = normalizeSubjCode(g.code);
    const titleKey = normalizeSubjCode(g.title);
    const key = (codeKey && !codeKey.startsWith('rec') && !codeKey.startsWith('gr')) ? codeKey : (titleKey || codeKey);
    if (key) {
      if (!recordsByCode.has(key)) recordsByCode.set(key, []);
      recordsByCode.get(key)!.push(g);
    }
    if (titleKey && titleKey !== key) {
      if (!recordsByCode.has(titleKey)) recordsByCode.set(titleKey, []);
      recordsByCode.get(titleKey)!.push(g);
    }
  });

  const completeList: AcademicGrade[] = [];
  const matchedCodes = new Set<string>();

  // 1. Process all subjects in the official curriculum
  curriculumDefs.forEach((def, idx) => {
    const normKey = normalizeSubjCode(def.code);
    matchedCodes.add(normKey);

    const unsortedAttempts = recordsByCode.get(normKey) || [];

    // Deduplicate records for the SAME term (same academic year & semester)
    // Avoids treating duplicate/re-imported entries in the exact same semester as multiple attempts
    const termMap = new Map<string, AcademicGrade>();
    unsortedAttempts.forEach(rec => {
      const rank = gradeRecencyRank(rec);
      const termKey = `${rank.yearStart || rec.academicYear || rec.term}-${rank.semRank || rec.semester}`;
      if (!termMap.has(termKey)) {
        termMap.set(termKey, rec);
      } else {
        const existing = termMap.get(termKey)!;
        const existDrop = existing.status === 'dropped' || existing.isDropped || existing.rawGrade === '9' || String(existing.rawGrade).toUpperCase() === 'DRP';
        const recDrop = rec.status === 'dropped' || rec.isDropped || rec.rawGrade === '9' || String(rec.rawGrade).toUpperCase() === 'DRP';
        const existGrade = Number(existing.grade);
        const recGrade = Number(rec.grade);
        const existPass = !existDrop && !isNaN(existGrade) && existGrade > 0 && existGrade <= 3.0;
        const recPass = !recDrop && !isNaN(recGrade) && recGrade > 0 && recGrade <= 3.0;

        if (recPass && !existPass) {
          termMap.set(termKey, rec);
        } else if (recPass && existPass) {
          if (!isNaN(recGrade) && !isNaN(existGrade) && recGrade < existGrade) {
            termMap.set(termKey, rec);
          }
        }
      }
    });

    // 🔴 ALWAYS sort attempts NEWEST-FIRST so "latestAttempt" means the current academic year
    const attempts = sortGradeAttemptsNewestFirst(Array.from(termMap.values()));

    if (attempts.length > 0) {
      // Find if student passed this subject in ANY attempt (regardless of year)
      // Real-world rule: once passed in a later semester, the old failure is irrelevant.
      const passedAttempt = attempts.find(a => {
        const isDrop = a.status === 'dropped' || a.isDropped || a.rawGrade === '9' || a.grade === 9 || String(a.rawGrade).toUpperCase() === 'DRP';
        const num = Number(a.grade);
        return !isDrop && !isNaN(num) && num > 0 && num <= 3.0;
      });

      // Format attempts history list (OLDEST first for display — shows chronological progress)
      const formattedAttempts = [...attempts].reverse().map(a => {
        const isDrop = a.status === 'dropped' || a.isDropped || a.rawGrade === '9' || a.grade === 9 || String(a.rawGrade).toUpperCase() === 'DRP';
        const num = Number(a.grade);
        const st: 'passed' | 'failed' | 'dropped' = isDrop ? 'dropped' : (!isNaN(num) && num > 0 && num <= 3.0 ? 'passed' : 'failed');
        return {
          term: a.term || `${a.academicYear || ''} ${a.semester === 2 ? '2nd' : (a.semester === 3 ? 'Summer' : '1st')} Sem`.trim(),
          academicYear: a.academicYear,
          semester: String(a.semester || ''),
          grade: isDrop ? null : a.grade,
          rawGrade: a.rawGrade,
          status: st
        };
      });

      // A subject is ONLY a retake if there was an actual deficiency (failed or dropped) in a prior attempt!
      const hasDeficiencyAttempt = attempts.some(a => {
        const isDrop = a.status === 'dropped' || a.isDropped || a.rawGrade === '9' || a.grade === 9 || String(a.rawGrade).toUpperCase() === 'DRP';
        const num = Number(a.grade);
        const isFail = a.status === 'failed' || (!isNaN(num) && num > 3.0) || num === 5;
        return isDrop || isFail;
      });

      const isRetake = Boolean(passedAttempt && hasDeficiencyAttempt && attempts.length > 1);

      if (passedAttempt) {
        // Primary record is the passed record (student has officially cleared this subject)
        completeList.push({
          id: passedAttempt.id || `cur-${student.student_id}-${normKey}`,
          studentId: student.student_id,
          studentName: student.name,
          code: def.code,
          title: def.title,
          units: def.units,
          grade: passedAttempt.grade,
          rawGrade: passedAttempt.rawGrade,
          term: passedAttempt.term || def.termName,
          academicYear: passedAttempt.academicYear,
          semester: def.semester,
          yearLevel: def.yearLevel,
          status: 'passed',
          isDropped: false,
          isRetake,
          attemptCount: attempts.length,
          attempts: formattedAttempts,
          curriculumTerm: def.termName
        });
      } else {
        // No pass on record → use the LATEST (newest-first, already sorted) attempt
        const latestAttempt = attempts[0];
        const isDrop = latestAttempt.status === 'dropped' || latestAttempt.isDropped || latestAttempt.rawGrade === '9' || latestAttempt.grade === 9;
        const num = Number(latestAttempt.grade);
        const status: 'passed' | 'failed' | 'dropped' = isDrop ? 'dropped' : 'failed';
        const finalGrade = isDrop ? null : (!isNaN(num) ? num : 5.0);

        completeList.push({
          id: latestAttempt.id || `cur-${student.student_id}-${normKey}`,
          studentId: student.student_id,
          studentName: student.name,
          code: def.code,
          title: def.title,
          units: def.units,
          grade: finalGrade,
          rawGrade: latestAttempt.rawGrade,
          term: latestAttempt.term || def.termName,
          academicYear: latestAttempt.academicYear,
          semester: def.semester,
          yearLevel: def.yearLevel,
          status,
          isDropped: isDrop,
          isRetake: attempts.length > 1,
          attemptCount: attempts.length,
          attempts: formattedAttempts,
          curriculumTerm: def.termName
        });
      }
    } else {
      // Student has not taken this subject yet (e.g. higher year level)
      completeList.push({
        id: `cur-unattempted-${student.student_id}-${normKey}-${idx}`,
        studentId: student.student_id,
        studentName: student.name,
        code: def.code,
        title: def.title,
        units: def.units,
        grade: null,
        rawGrade: null,
        term: def.termName,
        yearLevel: def.yearLevel,
        semester: def.semester,
        status: 'not_taken',
        isDropped: false,
        isRetake: false,
        attemptCount: 0,
        attempts: [],
        curriculumTerm: def.termName
      });
    }
  });

  // 2. Also include any subjects in DB that did not match standard curriculum (if any exist)
  existingGrades.forEach(g => {
    const key = normalizeSubjCode(g.code || g.title);
    if (!matchedCodes.has(key)) {
      matchedCodes.add(key);
      completeList.push({
        ...g,
        curriculumTerm: 'Elective / Additional'
      });
    }
  });

  return completeList;
}

export interface ActiveDeficiencyItem {
  code: string;
  title: string;
  units: number;
  lecUnits: number;
  labUnits: number;
  grade: number | null;
  rawGrade: string | number | null;
  status: 'failed' | 'dropped';
  term: string;
  yearLevel?: number;
  attemptCount: number;
  blocksCourses: string[];
}

export interface BlockedSubjectItem {
  code: string;
  title: string;
  units: number;
  lecUnits: number;
  labUnits: number;
  unmetPrerequisites: string[];
}

export interface CurriculumRecommendationAnalysis {
  studentId: string;
  studentName: string;
  program: string;
  yearLevel: number;
  section: string;
  schedule: string;
  activeDeficiencies: ActiveDeficiencyItem[];
  blockedSubjects: BlockedSubjectItem[];
  recommendedSubjects: RecommendedSubjectItem[];
  recommendedSubjectsBreakdown: {
    retakeCount: number;
    regularCount: number;
  };
  totalRecommendedUnits: number;
  totalLecUnits: number;
  totalLabUnits: number;
  totalPassedUnits: number;
  cumulativeGwa: number | null;
  academicStanding: 'regular' | 'irregular';
  targetTermLabel: string;
  targetYear: number;
  targetSemester: number;
  targetAcademicYear: string;
  hasSignificantBacklog: boolean;
  isLapsedStudent: boolean;
  lastEnrolledTermLabel: string;
  lastEnrolledAcademicYear: string | null;
  anchorYear: number;
  anchorSem: number;
}

/**
 * Helper: Build a friendly term label (e.g. "2nd Year • 1st Sem")
 */
function getTermLabel(yearLevel: number, semester: number): string {
  const yearMap: Record<number, string> = { 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year' };
  const semMap: Record<number, string> = { 1: '1st Sem', 2: '2nd Sem', 3: 'Summer' };
  // Guard: In GCT BSIT and BSCS curricula, Summer only exists in 3rd Year!
  if (semester === 3) {
    return '3rd Year • Summer';
  }
  return `${yearMap[yearLevel] || `Year ${yearLevel}`} • ${semMap[semester] || (semester === 3 ? 'Summer' : `Sem ${semester}`)}`;
}


/**
 * Evaluates student academic records against official GCT Curriculum & Prerequisite Rules
 * and generates strictly grounded subject recommendations.
 * 
 * - Unpassed failed or dropped subjects are auto-prioritized as Retake Required.
 * - Only regular subjects from the student's IMMEDIATE NEXT TARGET TERM are recommended.
 *   Subjects from the next target term whose prerequisites are unmet go to the "blocked" list instead.
 * - All recommended subjects strictly adhere to the GCT curriculum track.
 */
export function generateCurriculumRecommendations(
  student: Student,
  existingGrades: AcademicGrade[] = [],
  curriculumCatalog: CurriculumSubject[] = [],
  activeAcademicYear: string = '2027-2028',
  targetSemesterOverride?: number | string | null
): CurriculumRecommendationAnalysis {
  const progRaw = String(student.program || (student as any).course || 'BSIT').toUpperCase();
  const program = progRaw.includes('CS') ? 'BSCS' : 'BSIT';
  const curriculumDefs = program === 'BSCS' ? GCT_CURRICULUM_BSCS : GCT_CURRICULUM_BSIT;
  const studentYear = Math.min(4, Math.max(1, Number(student.year || (student as any).year_level || (student as any).yearLevel || 1)));

  // 1. Group student grades by canonical normalized code
  const gradesByCode = new Map<string, AcademicGrade[]>();
  existingGrades.forEach(g => {
    const codeNorm = normalizeSubjCode(g.code);
    const titleNorm = normalizeSubjCode(g.title);

    // Look for matching curriculum subject in official curriculum catalog / defs
    const curMatch = curriculumDefs.find(c => {
      const cCodeNorm = normalizeSubjCode(c.code);
      const cTitleNorm = normalizeSubjCode(c.title);
      return (codeNorm && cCodeNorm === codeNorm) || (titleNorm && cTitleNorm === titleNorm);
    });

    // Canonical key is the curriculum code if matched, otherwise codeNorm or titleNorm
    const canonicalKey = curMatch
      ? normalizeSubjCode(curMatch.code)
      : ((codeNorm && !codeNorm.startsWith('rec') && !codeNorm.startsWith('gr')) ? codeNorm : (titleNorm || codeNorm));

    if (canonicalKey) {
      if (!gradesByCode.has(canonicalKey)) gradesByCode.set(canonicalKey, []);
      gradesByCode.get(canonicalKey)!.push(g);
    }
  });

  // ===== LATEST GRADE RECORD ANCHOR (AC-1): target term sourced from REAL grade records =====
  let hasRealTermInfo = false;
  let latestYearStart = 0;
  let latestSemRank = 0;
  let latestAyStr: string | null = null;
  let latestTermRecords: AcademicGrade[] = [];

  existingGrades.forEach(g => {
    const rank = gradeRecencyRank(g);
    if (rank.yearStart > 0 || g.term || (g as any).academicYear || (g as any).academic_year || g.yearLevel || g.semester) {
      hasRealTermInfo = true;
    }
    if (rank.yearStart > latestYearStart || (rank.yearStart === latestYearStart && rank.semRank > latestSemRank)) {
      latestYearStart = rank.yearStart;
      latestSemRank = rank.semRank;
      latestAyStr = (g as any).academicYear || (g as any).academic_year || g.term?.match(/\d{4}-\d{4}/)?.[0] || null;
      latestTermRecords = [g];
    } else if (rank.yearStart === latestYearStart && rank.semRank === latestSemRank) {
      latestTermRecords.push(g);
    }
  });

  let anchorYear = NaN;
  let anchorSem = NaN;
  let lastEnrolledAcademicYear = latestAyStr;
  if (hasRealTermInfo && latestTermRecords.length > 0) {
    anchorSem = latestSemRank === 3 ? 3 : (latestSemRank === 2 ? 2 : 1);
    const yrsInTerm = latestTermRecords
      .map(r => {
        const yNum = Number(r.yearLevel || (r as any).year_level);
        if (Number.isFinite(yNum) && yNum >= 1 && yNum <= 4) return yNum;
        const norm = normalizeSubjCode(r.code || r.title);
        const matchDef = curriculumDefs.find(c => normalizeSubjCode(c.code) === norm);
        return matchDef ? matchDef.yearLevel : NaN;
      })
      .filter(y => Number.isFinite(y) && y >= 1 && y <= 4);
    if (yrsInTerm.length > 0) {
      anchorYear = Math.max(...yrsInTerm);
    }
  }

  const catalogYearRaw = Math.min(4, Math.max(1, Number(student.year || (student as any).year_level || (student as any).yearLevel || 1)));
  const rawCatalogSemRaw = student.semester !== undefined && student.semester !== null
    ? Number(student.semester)
    : NaN;

  // Effective anchor:
  const effectiveAnchorYear = Number.isFinite(anchorYear) && anchorYear >= 1 
    ? Math.max(anchorYear, catalogYearRaw) 
    : catalogYearRaw;

  let effectiveAnchorSem = 1;
  if (Number.isFinite(catalogYearRaw) && Number.isFinite(anchorYear) && catalogYearRaw > anchorYear) {
    effectiveAnchorSem = Number.isFinite(rawCatalogSemRaw) && rawCatalogSemRaw >= 1 && rawCatalogSemRaw <= 3 ? rawCatalogSemRaw : 1;
  } else if (Number.isFinite(anchorSem) && anchorSem >= 1 && anchorSem <= 3) {
    effectiveAnchorSem = anchorSem;
  } else if (Number.isFinite(rawCatalogSemRaw) && rawCatalogSemRaw >= 1 && rawCatalogSemRaw <= 3) {
    effectiveAnchorSem = rawCatalogSemRaw;
  }

  // Lapsed student detection
  let isLapsedStudent = false;
  let lastEnrolledTermLabel = '';
  if (lastEnrolledAcademicYear && activeAcademicYear) {
    const anchorM = String(lastEnrolledAcademicYear).match(/\d{4}/);
    const activeM = String(activeAcademicYear).match(/\d{4}/);
    if (anchorM && activeM) {
      const anchorStart = parseInt(anchorM[0], 10);
      const activeStart = parseInt(activeM[0], 10);
      isLapsedStudent = (activeStart - anchorStart) >= 2;
    }
    lastEnrolledTermLabel = `${getTermLabel(effectiveAnchorYear, effectiveAnchorSem)} • ${lastEnrolledAcademicYear}`;
  }

  // 🟢 SYNTHETIC GRADE ENRICHMENT: only synthesize strictly PRIOR terms
  const enrichmentTerms: Array<{ yr: number; sem: number }> = [];
  for (let y = 1; y < effectiveAnchorYear; y++) {
    enrichmentTerms.push({ yr: y, sem: 1 });
    enrichmentTerms.push({ yr: y, sem: 2 });
  }
  if (effectiveAnchorSem === 2) {
    enrichmentTerms.push({ yr: effectiveAnchorYear, sem: 1 });
  }

  const enrichedCodes: string[] = [];
  enrichmentTerms.forEach(({ yr, sem }) => {
    curriculumDefs
      .filter(c => c.yearLevel === yr && c.semester === sem)
      .forEach(c => {
        const norm = normalizeSubjCode(c.code);
        if (gradesByCode.has(norm)) return; // already has grade records (passed OR failed) — don't override

        // Synthesize a passing grade (2.0 default, reasonable)
        const synG: AcademicGrade = {
          id: `syn-enrich-${student.student_id}-${norm}`,
          studentId: student.student_id,
          studentName: student.name,
          code: c.code,
          title: c.title,
          units: c.units || 3,
          grade: 2.0,
          rawGrade: '2.0',
          term: `${2024 - (studentYear - yr)}-${2025 - (studentYear - yr)} ${sem === 1 ? '1st' : '2nd'} Sem`,
          academicYear: `${2024 - (studentYear - yr)}-${2025 - (studentYear - yr)}`,
          semester: sem,
          yearLevel: yr,
          status: 'passed',
          isDropped: false,
          attemptCount: 1
        };
        gradesByCode.set(norm, [synG]);
        enrichedCodes.push(c.code);
      });
  });

  // Track passed subjects and unpassed deficiencies
  const passedCodes = new Set<string>();
  const activeDeficiencies: ActiveDeficiencyItem[] = [];
  const activeDefCodes = new Set<string>();

  let totalWeighted = 0;
  let totalGradedUnits = 0;
  let totalPassedUnits = 0;

  gradesByCode.forEach((unsortedAttempts, normCode) => {
    // 🔴 ALWAYS sort NEWEST-FIRST first — this guarantees:
    //    - attempts[0] = the MOST RECENT (current AY) grade for the subject
    //    - If a student retook a subject and passed in a later semester,
    //      the passedAttempt lookup finds it and the old failure is DISCARDED.
    const attempts = sortGradeAttemptsNewestFirst(unsortedAttempts);

    // Check if passed in ANY attempt (across ANY academic year)
    // Realistic rule: passing grade in a later retake FOREVER clears the old failure.
    const passedAttempt = attempts.find(a => {
      const isDrop = a.status === 'dropped' || a.isDropped || a.rawGrade === '9' || a.grade === 9 || String(a.rawGrade).toUpperCase() === 'DRP';
      const isZero = a.grade === 0 || Number(a.grade) === 0 || a.rawGrade === '0' || a.rawGrade === '0.0' || a.rawGrade === '0.00' || String(a.rawGrade).trim() === '0';
      const num = Number(a.grade);
      return !isDrop && !isZero && !isNaN(num) && num >= 1.0 && num <= 3.0;
    });

    if (passedAttempt) {
      passedCodes.add(normCode);
      const units = Number(passedAttempt.units || 3);
      totalPassedUnits += units;
      const numGrade = Number(passedAttempt.grade);
      if (!isNaN(numGrade) && numGrade >= 1.0 && numGrade <= 3.0) {
        totalWeighted += numGrade * units;
        totalGradedUnits += units;
      }
    } else {
      // Check if there is an actual failed, dropped, zero, or unpassed attempt
      const hasFailOrDrop = attempts.some(a => {
        const isDrop = a.status === 'dropped' || a.isDropped || a.rawGrade === '9' || a.grade === 9 || String(a.rawGrade).toUpperCase() === 'DRP';
        const isZero = a.grade === 0 || Number(a.grade) === 0 || a.rawGrade === '0' || a.rawGrade === '0.0' || a.rawGrade === '0.00' || String(a.rawGrade).trim() === '0';
        const num = Number(a.grade);
        const isFail = a.status === 'failed' || isZero || a.rawGrade === '5' || a.rawGrade === '5.0' || a.grade === 5 || (!isNaN(num) && num > 3.0) || a.status !== 'passed';
        return isDrop || isFail || a.status !== 'not_taken';
      });

      if (hasFailOrDrop) {
        // No pass anywhere and has a recorded fail/drop/unpassed attempt → active deficiency
        const latestAttempt = attempts[0];
        const isDrop = latestAttempt.status === 'dropped' || latestAttempt.isDropped || latestAttempt.rawGrade === '9' || latestAttempt.grade === 9 || String(latestAttempt.rawGrade).toUpperCase() === 'DRP';
        const isLatestZero = latestAttempt.grade === 0 || Number(latestAttempt.grade) === 0 || latestAttempt.rawGrade === '0' || latestAttempt.rawGrade === '0.0' || String(latestAttempt.rawGrade).trim() === '0';
        const defDef = curriculumDefs.find(c => normalizeSubjCode(c.code) === normCode);
        const liveDef = curriculumCatalog.find(c => normalizeSubjCode(c.code) === normCode);

        const code = defDef?.code || liveDef?.code || latestAttempt.code;
        const title = defDef?.title || liveDef?.title || latestAttempt.title;
        const units = Number(defDef?.units || liveDef?.units || latestAttempt.units || 3);
        const lecUnits = Number(liveDef?.lecUnits || (units > 2 ? units - 1 : units));
        const labUnits = Number(liveDef?.labUnits || (units > 2 ? 1 : 0));
        const defNorm = normalizeSubjCode(code);

        if (!activeDefCodes.has(defNorm)) {
          activeDefCodes.add(defNorm);
          activeDeficiencies.push({
            code,
            title,
            units,
            lecUnits,
            labUnits,
            grade: isDrop ? null : (isLatestZero ? 5.0 : (Number(latestAttempt.grade) || 5.0)),
            rawGrade: isDrop ? '9' : (isLatestZero ? '5.0' : (latestAttempt.rawGrade || '5.0')),
            status: isDrop ? 'dropped' : 'failed',
            term: latestAttempt.term || 'Previous Term',
            attemptCount: attempts.length,
            blocksCourses: []
          });
        }
      }
    }
  });

  const cumulativeGwa = totalGradedUnits > 0 ? Number((totalWeighted / totalGradedUnits).toFixed(2)) : null;

  // 2. Build prerequisite map from curriculum catalog / defs
  const prereqMap = new Map<string, string[]>(); // normalized subject code -> list of required normalized prereq codes
  // Inline helper: Is this normalized token actually a known VALID subject code that
  // exists in the curriculum (either in the program defs or the catalog)? This filters
  // out English text phrases that accidentally passed the non-empty/non-None check.
  const knownCodeSet = new Set<string>();
  curriculumDefs.forEach(c => knownCodeSet.add(normalizeSubjCode(c.code)));
  curriculumCatalog.forEach(c => knownCodeSet.add(normalizeSubjCode(c.code)));

  curriculumCatalog.forEach(cs => {
    if (cs.program === program && cs.prerequisites && cs.prerequisites !== 'None') {
      const rawSplit = cs.prerequisites.split(/[,&;]+/);
      const pList = rawSplit
        .map((p: string) => normalizeSubjCode(p.trim()))
        .filter((normTok: string) => {
          if (!normTok || normTok.length < 3) return false;
          // 🔒 HARD FILTER: Only accept as a real prerequisite if the normalized token
          // corresponds to a KNOWN SUBJECT CODE in this curriculum. Any free-form English
          // text (like "See curriculum flowchart", "Programming fundamentals", etc.)
          // that doesn't match an actual code is safely ignored — prerequisite falls back
          // to standardPrereqs chain below.
          return knownCodeSet.has(normTok);
        });
      if (pList.length > 0) {
        prereqMap.set(normalizeSubjCode(cs.code), pList);
      }
    }
  });

  // Official GCT Institutional Prerequisites (from verified Registrar catalog & database)
  const standardPrereqsBSIT: Record<string, string[]> = {
    'cw1': ['engl1'],
    'hum1': ['uts1'],
    'cc103': ['cc102'],
    'cc104': ['cc101'],
    'pe2': ['pe1'],
    'nstp2': ['nstp1'],
    'sts2': ['sts1'],
    'cc105': ['cc103'],
    'cc106': ['cc103'],
    'it1': ['cc103'],
    'it2': ['cc104'],
    'it3': ['cc103'],
    'pe3': ['pe2'],
    'it4': ['cc106'],
    'it5': ['it2'],
    'it6': ['it2'],
    'it7': ['math1'],
    'it8': ['it3'],
    'ttrep1': ['it2'],
    'fili2': ['fili1'],
    'rizal1': ['histo1'],
    'pe4': ['pe3'],
    'it9': ['it5'],
    'it10': ['it6'],
    'it11': ['ttrep1'],
    'it12': ['it6'],
    'it13': ['it5'],
    'it14': ['it6'],
    'math4': ['math1'],
    'ite1': ['it10'],
    'it15': ['it14'],
    'it16': ['ethics1'],
    'it17': ['it12'],
    'it18': ['math4'],
    'it19': ['it10'],
    'ite2': ['it11'],
    'cp1': ['it15', 'it17'],
    'cp2': ['cp1'],
    'ite3': ['it13'],
    'ite4': ['it19'],
    'ite5': ['ite4'],
    'ojtit': ['cp2']
  };

  const standardPrereqsBSCS: Record<string, string[]> = {
    'cw1': ['engl1'],
    'hum1': ['uts1'],
    'cc103': ['cc102'],
    'cc104': ['cc101'],
    'cs01': ['math1'],
    'pe2': ['pe1'],
    'nstp2': ['nstp1'],
    'sts2': ['sts1'],
    'cc105': ['cc103'],
    'cc106': ['cc103'],
    'cs1': ['cc103'],
    'cs2': ['cc103'],
    'cse1': ['cc104'],
    'pe3': ['pe2'],
    'ttrep1': ['cc104'],
    'cs3': ['cc105'],
    'cs4': ['cs1'],
    'cs5': ['cc105'],
    'cs6': ['cs1'],
    'cs7': ['cs2'],
    'pe4': ['pe3'],
    'cs8': ['cs7'],
    'cs9': ['cs7'],
    'cs10': ['cs4'],
    'cs11': ['cse1'],
    'cs12': ['cs5'],
    'cse2': ['cs4'],
    'math4': ['math1'],
    'cs13': ['cs12'],
    'cs14': ['ethics1'],
    'cs15': ['cs10'],
    'cs16': ['cs6'],
    'cs17': ['cs12'],
    'cs18': ['cs8'],
    'cse3': ['cs17'],
    'cs19': ['cs7'],
    'cse4': ['cse2'],
    'cse5': ['cse4'],
    'ths1': ['cs10', 'cs11'],
    'ths2': ['ths1'],
    'ojtcs': ['ths2']
  };

  const standardPrereqs = program === 'BSCS' ? standardPrereqsBSCS : standardPrereqsBSIT;

  Object.entries(standardPrereqs).forEach(([sCode, pList]) => {
    if (!prereqMap.has(sCode)) {
      prereqMap.set(sCode, pList);
    }
  });

  // 🎓 Institutional Capstone Rule:
  // After completing 3rd year, students can only take Capstone (CP 1 / CP 2 or THS 1 / THS 2)
  // if they have ZERO deficiencies in ANY major subject from Year 1 to Year 3.
  // Any unpassed major subject strictly blocks Capstone 1 and Capstone 2!
  const unpassedMajorDeficiencies = activeDeficiencies.filter(def => {
    const defNorm = normalizeSubjCode(def.code);
    const defDef = curriculumDefs.find(c => normalizeSubjCode(c.code) === defNorm);
    const yLevel = defDef ? defDef.yearLevel : (def.yearLevel ?? 1);
    return yLevel <= 3 && isMajorSubject(def.code, student.program);
  });

  // 🎓 Institutional OJT / Practicum Rule:
  // Students CANNOT take OJT (OJT-IT / OJT-CS) until they have passed ALL failed major subjects
  // across all year levels. Any unpassed major subject strictly blocks OJT!
  const allUnpassedMajorDeficiencies = activeDeficiencies.filter(def => {
    return isMajorSubject(def.code, student.program);
  });

  // 3. Mark which courses each deficiency blocks
  activeDeficiencies.forEach(def => {
    const defNorm = normalizeSubjCode(def.code);
    const blocked: string[] = [];

    curriculumDefs.forEach(c => {
      const cNorm = normalizeSubjCode(c.code);
      const reqPrereqs = prereqMap.get(cNorm) || [];
      if (reqPrereqs.includes(defNorm)) {
        blocked.push(c.code);
      }
    });

    // If this deficiency is a Year 1-3 Major Subject, it ALSO strictly blocks Capstone 1 and Capstone 2!
    const defDef = curriculumDefs.find(c => normalizeSubjCode(c.code) === defNorm);
    const yLevel = defDef ? defDef.yearLevel : (def.yearLevel ?? 1);
    if (yLevel <= 3 && isMajorSubject(def.code, student.program)) {
      const capstoneCodes = student.program === 'BSCS' ? ['THS 1', 'THS 2'] : ['CP 1', 'CP 2'];
      capstoneCodes.forEach(capCode => {
        if (!blocked.includes(capCode)) blocked.push(capCode);
      });
    }

    // If this deficiency is ANY Major Subject, it ALSO strictly blocks OJT!
    if (isMajorSubject(def.code, student.program)) {
      const ojtCode = student.program === 'BSCS' ? 'OJT-CS' : 'OJT-IT';
      if (!blocked.includes(ojtCode)) blocked.push(ojtCode);
    }

    def.blocksCourses = blocked;
  });

  // 4. Determine CURRENT TARGET TERM
  // The system recommends subjects appropriate for the student's CURRENT enrolled semester
  // Retakes of failed/dropped subjects from prior terms are ALWAYS included as top priority
  // (studentYear / hasExplicitSemester / explicitSemester — declared at TOP of function, used by enrichment)

  function advanceTerm(y: number, s: number): { y: number; s: number } | null {
    if (s === 1) return { y, s: 2 };
    if (s === 2 && y === 3) return { y: 3, s: 3 }; // 3rd Year has required Summer
    if (y < 4) return { y: y + 1, s: 1 };
    return null;
  }

  // 🎯 CORRECT TARGET TERM LOGIC:
  // 1. ANCHOR at the student's OFFICIAL CATALOG YEAR LEVEL (student.year) — NEVER go backwards.
  //    A Year 2 student should NEVER get 1st Year subjects recommended.
  // 2. DEFAULT to Semester 1 ("just in 1st sem") if semester is not explicitly set.
  //    (The registrar's default assumption is a student starts each year in 1st sem.)
  // 3. ONLY ADVANCE forward if there is IRREFUTABLE proof (100% attendance) that the
  //    current target term has already been completed.
  const hasSignificantBacklog = activeDeficiencies.length >= 3;

  // 🎯 ANCHOR: Target term starts at the latest grade record, NOT student catalog year!
  let targetYear: number = effectiveAnchorYear;
  let targetSemester: number = effectiveAnchorSem;

  // If the student already attended/enrolled in this anchor term (grades exist for it),
  // they advance to the NEXT semester (the upcoming term to enroll in).
  const hasAttendedAnchorTerm = (hasRealTermInfo && latestTermRecords.length > 0 && anchorYear === effectiveAnchorYear && anchorSem === effectiveAnchorSem) ||
    curriculumDefs.filter(c => c.yearLevel === effectiveAnchorYear && c.semester === effectiveAnchorSem).some(ts => {
      const norm = normalizeSubjCode(ts.code);
      return passedCodes.has(norm) || activeDeficiencies.some(d => normalizeSubjCode(d.code) === norm) || gradesByCode.has(norm);
    });

  if (hasAttendedAnchorTerm) {
    const next = advanceTerm(effectiveAnchorYear, effectiveAnchorSem);
    if (next) {
      targetYear = next.y;
      targetSemester = next.s;
    }
  }

  // Advance forward as long as subsequent candidate terms were also 100% completed in the past
  while (targetYear <= 4) {
    const termSubjs = curriculumDefs.filter(c => c.yearLevel === targetYear && c.semester === targetSemester);
    const isTermComplete = termSubjs.length > 0 && termSubjs.every(ts => {
      const norm = normalizeSubjCode(ts.code);
      return passedCodes.has(norm);
    });

    if (isTermComplete) {
      const next = advanceTerm(targetYear, targetSemester);
      if (!next) break;
      targetYear = next.y;
      targetSemester = next.s;
    } else {
      break;
    }
  }

  // Minimum student standing year (from catalog year and attended grade records)
  const standingYear = Math.min(4, Math.max(studentYear, Number.isFinite(effectiveAnchorYear) ? effectiveAnchorYear : 1));

  // Safety hard-cap: NEVER allow target year to go below student's standing year level
  if (targetYear < standingYear) {
    targetYear = standingYear;
  }

  // 🎯 User-specified target semester override (1st Semester, 2nd Semester, Summer)
  if (targetSemesterOverride !== undefined && targetSemesterOverride !== null && targetSemesterOverride !== '' && targetSemesterOverride !== 'auto') {
    const overrideStr = String(targetSemesterOverride).toLowerCase().trim();
    if (overrideStr === 'summer' || overrideStr === '3') {
      targetSemester = 3;
    } else if (overrideStr === '2') {
      targetSemester = 2;
    } else {
      targetSemester = 1;
    }

    // Determine target curriculum year level:
    // A student's regular track year must be at least their current standing year (e.g. 3rd Year).
    // It should NEVER be downgraded to an earlier year (e.g. Year 2) just because of unpassed retakes,
    // because retakes from ANY earlier year are already prioritized and added under Priority 1 (Retakes)!
    // If all regular subjects for this semester in standingYear are ALREADY passed, advance to the next year (max 4).
    let determinedYear = standingYear;
    while (determinedYear < 4) {
      // 🔒 HARD RULE: Cannot advance to 4th Year unless 3rd Year Summer has been completed!
      if (determinedYear === 3) {
        const summerSubjs = curriculumDefs.filter(c => c.yearLevel === 3 && c.semester === 3);
        const summerPassed = summerSubjs.length > 0 && summerSubjs.every(c => passedCodes.has(normalizeSubjCode(c.code)));
        if (!summerPassed) {
          break; // Stop here! Student remains in Year 3 because 3rd Year Summer is still required!
        }
      }

      const termSubjs = curriculumDefs.filter(c => c.yearLevel === determinedYear && c.semester === targetSemester);
      const allPassed = termSubjs.length > 0 && termSubjs.every(c => passedCodes.has(normalizeSubjCode(c.code)));
      if (allPassed) {
        determinedYear++;
      } else {
        break;
      }
    }

    // If the student has completed 3rd Year 2nd Sem, but NOT 3rd Year Summer:
    // They cannot take 4th Year subjects. Their mandatory upcoming term is 3rd Year Summer!
    const summerSubjs = curriculumDefs.filter(c => c.yearLevel === 3 && c.semester === 3);
    const summerPassed = summerSubjs.length > 0 && summerSubjs.every(c => passedCodes.has(normalizeSubjCode(c.code)));
    if (standingYear === 3 && !summerPassed && determinedYear === 3 && (targetSemester === 1 || targetSemester === 2)) {
      const y3SemSubjs = curriculumDefs.filter(c => c.yearLevel === 3 && c.semester === targetSemester);
      const y3SemAllPassed = y3SemSubjs.length > 0 && y3SemSubjs.every(c => passedCodes.has(normalizeSubjCode(c.code)));
      if (y3SemAllPassed) {
        targetSemester = 3; // Auto-target 3rd Year Summer!
      }
    }

    // 🔒 Summer term (semester 3) in GCT BSIT and BSCS curricula ONLY exists in 3rd Year!
    // 4th Year NEVER has a summer term.
    if (targetSemester === 3) {
      if (determinedYear >= 4) {
        if (!summerPassed) {
          targetYear = 3;
          targetSemester = 3;
        } else {
          targetYear = 4;
          const y4Sem1Subjs = curriculumDefs.filter(c => c.yearLevel === 4 && c.semester === 1);
          const y4Sem1Passed = y4Sem1Subjs.length > 0 && y4Sem1Subjs.every(c => passedCodes.has(normalizeSubjCode(c.code)));
          targetSemester = y4Sem1Passed ? 2 : 1;
        }
      } else {
        targetYear = 3;
      }
    } else {
      targetYear = determinedYear;
    }
  } else {
    // Auto-detect natural term progression:
    // If the initial targetYear/targetSemester was already 100% completed,
    // advance forward starting from targetYear to find the earliest term in the curriculum with unpassed subjects!
    const currentTermSubjs = curriculumDefs.filter(c => c.yearLevel === targetYear && c.semester === targetSemester);
    const allCurrentPassed = currentTermSubjs.length > 0 && currentTermSubjs.every(c => passedCodes.has(normalizeSubjCode(c.code)));
    if (allCurrentPassed) {
      let found = false;
      for (let y = targetYear; y <= 4 && !found; y++) {
        const maxS = y === 3 ? 3 : 2;
        for (let s = 1; s <= maxS && !found; s++) {
          if (y === targetYear && s <= targetSemester) continue;
          const termSubjs = curriculumDefs.filter(c => c.yearLevel === y && c.semester === s);
          if (termSubjs.length > 0 && termSubjs.some(c => !passedCodes.has(normalizeSubjCode(c.code)))) {
            targetYear = y;
            targetSemester = s;
            found = true;
          }
        }
      }
    }
    targetYear = Math.max(targetYear, standingYear);

    // 🔒 Enforce: Summer term NEVER exists in 4th Year
    if (targetYear >= 4 && targetSemester === 3) {
      const summerSubjs = curriculumDefs.filter(c => c.yearLevel === 3 && c.semester === 3);
      const summerPassed = summerSubjs.length > 0 && summerSubjs.every(c => passedCodes.has(normalizeSubjCode(c.code)));
      if (!summerPassed) {
        targetYear = 3;
        targetSemester = 3;
      } else {
        targetYear = 4;
        const y4Sem1Subjs = curriculumDefs.filter(c => c.yearLevel === 4 && c.semester === 1);
        const y4Sem1Passed = y4Sem1Subjs.length > 0 && y4Sem1Subjs.every(c => passedCodes.has(normalizeSubjCode(c.code)));
        targetSemester = y4Sem1Passed ? 2 : 1;
      }
    }
  }

  // Candidate subjects: all curriculum subjects offered in targetSemester up to student's target year
  // (Lower year levels are sorted first so backlogs are prioritized before current year subjects)
  const candidateCurriculumSubjects = curriculumDefs
    .filter(c => {
      if (targetSemester === 3) return c.semester === 3 && c.yearLevel <= targetYear;
      return c.semester === targetSemester && c.yearLevel <= targetYear;
    })
    .sort((a, b) => a.yearLevel - b.yearLevel);

  const recommendedSubjects: RecommendedSubjectItem[] = [];
  const blockedSubjects: BlockedSubjectItem[] = [];
  const alreadyRecommendedCodes = new Set<string>();

  // A. Priority 1: Retake Deficiencies (Failed or Dropped) matching the CURRENT TARGET SEMESTER offering
  // Curriculum Rule: 1st sem subjects are only offered in 1st sem, and 2nd sem subjects in 2nd sem.
  // A student who failed a 1st sem subject can only retake it in the NEXT ACADEMIC YEAR SAME SEMESTER (1st sem).
  // So when enrolling for 2nd sem, only 2nd sem retakes (if any from prior years) are offered.
  // 1st sem failed subjects are NOT recommended in the 2nd sem.
  activeDeficiencies.forEach((def, idx) => {
    const defNorm = normalizeSubjCode(def.code);
    if (alreadyRecommendedCodes.has(defNorm)) return;

    const defDef = curriculumDefs.find(c => normalizeSubjCode(c.code) === defNorm);
    const liveDef = curriculumCatalog.find(c => normalizeSubjCode(c.code) === defNorm);
    const defSem = defDef?.semester ?? Number(liveDef?.semester ?? 1);

    // ONLY recommend for enrollment in the current term IF the deficiency's offering semester matches targetSemester!
    // Institutional Curriculum Rule:
    // - 1st sem subjects are offered in 1st sem only.
    // - 2nd sem subjects (such as IT 5) are offered in 2nd sem only.
    // - Summer (semester 3) is strictly for summer-designated curriculum subjects.
    // Regular 1st or 2nd sem failed subjects MUST NOT be recommended during Summer; they must be retaken in their designated semester.
    const isEligibleForTerm = defSem === targetSemester;

    if (isEligibleForTerm) {
      alreadyRecommendedCodes.add(defNorm);

      // Check if this retake subject itself has prerequisites that are currently unpassed
      const reqPrereqs = prereqMap.get(defNorm) || [];
      const unmetPrereqs = reqPrereqs.filter(p => !passedCodes.has(p));

      if (unmetPrereqs.length > 0) {
        const unmetCodes = unmetPrereqs.map(p => {
          const found = curriculumDefs.find(c => normalizeSubjCode(c.code) === p);
          return found ? found.code : p.toUpperCase();
        });
        blockedSubjects.push({
          code: def.code,
          title: def.title,
          units: def.units,
          lecUnits: def.lecUnits,
          labUnits: def.labUnits,
          unmetPrerequisites: [`Prerequisite for retake not met: ${unmetCodes.join(', ')}`]
        });
      } else {
        const isDrop = def.status === 'dropped';
        recommendedSubjects.push({
          id: `rec-retake-${student.student_id}-${defNorm}-${idx}`,
          code: def.code,
          title: def.title,
          lecUnits: def.lecUnits,
          labUnits: def.labUnits,
          totalUnits: def.units,
          prerequisites: isDrop ? `Retake Required (Dropped in ${def.term})` : `Retake Required (Failed 5.00 in ${def.term})`,
          isApproved: false,
          remarks: targetSemester === 3
            ? 'Retake Required (Summer Offering)'
            : `Retake Required (${defSem === 1 ? '1st' : '2nd'} Sem Offering)`
        });
      }
    }
  });

  // B. Priority 2: Regular Track Subjects for the CURRENT TARGET SEMESTER (Backlog + Current Year)
  //    Only those subjects NOT already passed and NOT in retakes above.
  const nextTermRegularCandidates = candidateCurriculumSubjects.filter(c => {
    const norm = normalizeSubjCode(c.code);
    return !passedCodes.has(norm) && !alreadyRecommendedCodes.has(norm);
  });

  nextTermRegularCandidates.forEach((subj, idx) => {
    const subjNorm = normalizeSubjCode(subj.code);
    if (alreadyRecommendedCodes.has(subjNorm)) return;
    alreadyRecommendedCodes.add(subjNorm);

    const requiredPrereqs = prereqMap.get(subjNorm) || [];

    // Check if ALL prerequisites are passed (this ensures they can take the subject)
    const unmetPrereqs = requiredPrereqs.filter(p => !passedCodes.has(p));

    // 🎓 INSTITUTIONAL RULE: Capstone 1 & 2 (or Thesis 1 & 2) require ALL 1st–3rd Year Major Subjects passed with 0 deficiencies!
    const isCapstone = isCapstoneSubject(subj.code);
    const hasMajorDeficiencies = isCapstone && unpassedMajorDeficiencies.length > 0;

    // 🎓 INSTITUTIONAL RULE: OJT (OJT-IT or OJT-CS) requires ALL Major Subjects across all years passed with 0 deficiencies!
    const isOjt = isOjtSubject(subj.code);
    const hasOjtDeficiencies = isOjt && allUnpassedMajorDeficiencies.length > 0;

    const catalogEntry = curriculumCatalog.find(c => normalizeSubjCode(c.code) === subjNorm);
    const units = subj.units || catalogEntry?.units || 3;
    const lecUnits = Number(catalogEntry?.lecUnits || (units > 2 ? units - 1 : units));
    const labUnits = Number(catalogEntry?.labUnits || (units > 2 ? 1 : 0));

    if (unmetPrereqs.length > 0 || hasMajorDeficiencies || hasOjtDeficiencies) {
      // BLOCKED: Subject is part of the term offerings BUT prerequisites or institutional rules not cleared
      const unmetCodes = unmetPrereqs.map(p => {
        const found = curriculumDefs.find(c => normalizeSubjCode(c.code) === p);
        return found ? found.code : p.toUpperCase();
      });

      if (hasMajorDeficiencies) {
        unmetCodes.unshift(`All 1st–3rd Yr Major Subjects Passed (0 Deficiencies Required — Unpassed: ${unpassedMajorDeficiencies.map(d => d.code).join(', ')})`);
      }

      if (hasOjtDeficiencies) {
        unmetCodes.unshift(`All Major Subjects Cleared (0 Deficiencies Required before OJT — Unpassed: ${allUnpassedMajorDeficiencies.map(d => d.code).join(', ')})`);
      }

      blockedSubjects.push({
        code: subj.code,
        title: subj.title,
        units,
        lecUnits,
        labUnits,
        unmetPrerequisites: unmetCodes
      });
    } else {
      // ELIGIBLE: 100% of prerequisites are passed, subject can be taken this term
      let prereqNote = 'None required';
      if (isCapstone) {
        prereqNote = (subjNorm === 'cp1' || subjNorm === 'ths1')
          ? '✓ Prerequisite cleared (All 1st–3rd Year Major Subjects cleared with 0 Deficiencies)'
          : '✓ Prerequisite cleared (Capstone 1 passed & All 1st–3rd Year Majors cleared)';
      } else if (isOjt) {
        prereqNote = '✓ Prerequisite cleared (All Major Subjects cleared with 0 Deficiencies)';
      } else if (requiredPrereqs.length > 0) {
        const clearedCodes = requiredPrereqs.map(p => {
          const found = curriculumDefs.find(c => normalizeSubjCode(c.code) === p);
          return found ? found.code : p.toUpperCase();
        });
        prereqNote = `✓ Prerequisite cleared (${clearedCodes.join(', ')})`;
      }

      const isBacklog = subj.yearLevel < targetYear;
      const priorAttempts = gradesByCode.get(subjNorm) || [];
      const hasPriorUnpassed = priorAttempts.some(a => a.status !== 'not_taken');
      const latestPrior = priorAttempts[0];

      let termRemark = isBacklog
        ? `Backlog Subject (${getTermLabel(subj.yearLevel, subj.semester)})`
        : `Regular Track Subject (${getTermLabel(targetYear, targetSemester)})`;

      if (hasPriorUnpassed && latestPrior) {
        const isPriorDrop = latestPrior.status === 'dropped' || latestPrior.isDropped || latestPrior.rawGrade === '9' || latestPrior.grade === 9;
        const priorGradeStr = (latestPrior.grade !== null && !isNaN(Number(latestPrior.grade)) && Number(latestPrior.grade) > 0) ? Number(latestPrior.grade).toFixed(2) : '5.00';
        termRemark = isPriorDrop
          ? `Retake Required (Dropped in ${latestPrior.term || 'earlier term'})`
          : `Retake Required (Previous attempt in ${latestPrior.term || 'earlier term'} not passed - ${priorGradeStr})`;
      }

      recommendedSubjects.push({
        id: `rec-reg-${student.student_id}-${subjNorm}-${idx}`,
        code: subj.code,
        title: subj.title,
        lecUnits,
        labUnits,
        totalUnits: units,
        prerequisites: prereqNote,
        isApproved: false,
        remarks: termRemark
      });
    }
  });

  // Final deduplication safety pass: guarantee ZERO duplicates in recommendedSubjects
  const uniqueRecommended: RecommendedSubjectItem[] = [];
  const seenRecNorms = new Set<string>();
  for (const item of recommendedSubjects) {
    const norm = normalizeSubjCode(item.code);
    if (norm && !seenRecNorms.has(norm)) {
      seenRecNorms.add(norm);
      uniqueRecommended.push(item);
    }
  }

  // Final deduplication safety pass: guarantee ZERO duplicates in activeDeficiencies
  const uniqueActiveDeficiencies: ActiveDeficiencyItem[] = [];
  const seenDefNorms = new Set<string>();
  for (const item of activeDeficiencies) {
    const norm = normalizeSubjCode(item.code);
    if (norm && !seenDefNorms.has(norm)) {
      seenDefNorms.add(norm);
      uniqueActiveDeficiencies.push(item);
    }
  }

  // Final deduplication safety pass: guarantee ZERO duplicates in blockedSubjects
  const uniqueBlocked: BlockedSubjectItem[] = [];
  const seenBlockedNorms = new Set<string>();
  for (const item of blockedSubjects) {
    const norm = normalizeSubjCode(item.code);
    if (norm && !seenRecNorms.has(norm) && !seenBlockedNorms.has(norm)) {
      seenBlockedNorms.add(norm);
      uniqueBlocked.push(item);
    }
  }

  // Calculate totals
  const totalRecommendedUnits = uniqueRecommended.reduce((sum, s) => sum + (s.totalUnits || 0), 0);
  const totalLecUnits = uniqueRecommended.reduce((sum, s) => sum + (s.lecUnits || 0), 0);
  const totalLabUnits = uniqueRecommended.reduce((sum, s) => sum + (s.labUnits || 0), 0);
  const academicStanding: 'regular' | 'irregular' = uniqueActiveDeficiencies.length > 0 ? 'irregular' : 'regular';
  const retakeCount = uniqueRecommended.filter(s => (s.remarks && s.remarks.toLowerCase().includes('retake')) || (s.prerequisites && s.prerequisites.toLowerCase().includes('retake'))).length;
  const regularCount = uniqueRecommended.length - retakeCount;

  // Determine target academic year:
  // Relative to student's enrolled grade history or active AY
  let targetAcademicYear = activeAcademicYear || '2027-2028';
  if (hasRealTermInfo && Number.isFinite(effectiveAnchorYear) && latestYearStart > 0) {
    const yrDiff = targetYear - effectiveAnchorYear;
    const targetStartYear = latestYearStart + yrDiff;
    targetAcademicYear = `${targetStartYear}-${targetStartYear + 1}`;
  } else {
    const anyWithAy = existingGrades.find(g => (g.academicYear || (g as any).academic_year || g.term?.match(/\d{4}-\d{4}/)) && (g.yearLevel || (g as any).year_level));
    if (anyWithAy) {
      const match = (anyWithAy.academicYear || (anyWithAy as any).academic_year || anyWithAy.term || '').match(/\d{4}/);
      if (match) {
        const anchorStart = parseInt(match[0], 10);
        const anchorYl = anyWithAy.yearLevel || (anyWithAy as any).year_level || 1;
        const targetStartYear = anchorStart + (targetYear - anchorYl);
        targetAcademicYear = `${targetStartYear}-${targetStartYear + 1}`;
      }
    }
  }

  return {
    studentId: student.student_id,
    studentName: student.name,
    program,
    yearLevel: studentYear,
    section: student.section || 'A',
    schedule: student.schedule || 'Schedule 1',
    activeDeficiencies: uniqueActiveDeficiencies,
    blockedSubjects: uniqueBlocked,
    recommendedSubjects: uniqueRecommended,
    recommendedSubjectsBreakdown: {
      retakeCount,
      regularCount
    },
    totalRecommendedUnits,
    totalLecUnits,
    totalLabUnits,
    totalPassedUnits,
    cumulativeGwa,
    academicStanding,
    targetTermLabel: getTermLabel(targetYear, targetSemester),
    targetYear,
    targetSemester,
    targetAcademicYear,
    hasSignificantBacklog,
    isLapsedStudent,
    lastEnrolledTermLabel,
    lastEnrolledAcademicYear,
    anchorYear: effectiveAnchorYear,
    anchorSem: effectiveAnchorSem
  };
}
