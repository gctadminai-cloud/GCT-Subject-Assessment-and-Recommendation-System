import type {
  ProgramInfo,
  Student,
  AcademicGrade,
  CurriculumSubject,
  StudentRecommendationRecord,
  StaffAccount,
  CsvPreviewRow,
  OcrDetectedRow
} from './types';
import { GCT_CURRICULUM_BSIT, GCT_CURRICULUM_BSCS, normalizeSubjCode } from '../utils/curriculumData';

export const GCT_GRADE_SCALE = [1.0, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00, 3.25, 3.50, 3.75, 4.00, 4.25, 4.50, 4.75, 5.00];

export const PROGRAM_CATALOG: ProgramInfo[] = [
  {
    code: 'BSIT',
    name: 'Bachelor of Science in Information Technology',
    department: 'College of Computer Studies',
    color: '#1D4ED8',
    bgColor: '#EFF6FF',
    description: 'Software development, web systems, database management, and network infrastructure.'
  },
  {
    code: 'BSCS',
    name: 'Bachelor of Science in Computer Science',
    department: 'College of Computer Studies',
    color: '#1D4ED8',
    bgColor: '#EFF6FF',
    description: 'Algorithmic computing, artificial intelligence, data structures, and computational theory.'
  },
  {
    code: 'BSBA',
    name: 'Bachelor of Science in Business Administration',
    department: 'College of Business',
    color: '#059669',
    bgColor: '#ECFDF5',
    description: 'Business management, marketing, finance, and entrepreneurship fundamentals.'
  }
];

// Sample ID and Selfie verification mock image data URLs
export const createMockIdFront = (name: string, id: string, program: string) =>
  `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250" viewBox="0 0 400 250"><rect width="400" height="250" rx="14" fill="%231E3A8A"/><rect x="15" y="15" width="370" height="220" rx="10" fill="%23FFFFFF"/><rect x="15" y="15" width="370" height="50" rx="10" fill="%232563EB"/><text x="200" y="38" fill="%23FFFFFF" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle">GARCIA COLLEGE OF TECHNOLOGY</text><text x="200" y="54" fill="%23DBEAFE" font-family="sans-serif" font-size="9" text-anchor="middle">OFFICIAL STUDENT IDENTIFICATION CARD (FRONT)</text><rect x="35" y="85" width="85" height="105" rx="8" fill="%23E2E8F0" stroke="%23CBD5E1"/><circle cx="77" cy="120" r="22" fill="%2394A3B8"/><path d="M50 170 Q77 145 104 170" fill="%2394A3B8"/><text x="135" y="105" fill="%2364748B" font-family="sans-serif" font-size="9" font-weight="bold">STUDENT NAME</text><text x="135" y="125" fill="%230F172A" font-family="sans-serif" font-size="14" font-weight="bold">${encodeURIComponent(name)}</text><text x="135" y="148" fill="%2364748B" font-family="sans-serif" font-size="9" font-weight="bold">STUDENT ID NO.</text><text x="135" y="166" fill="%232563EB" font-family="sans-serif" font-size="13" font-weight="bold">${encodeURIComponent(id)}</text><text x="135" y="188" fill="%2364748B" font-family="sans-serif" font-size="9" font-weight="bold">DEGREE PROGRAM</text><text x="135" y="206" fill="%230F172A" font-family="sans-serif" font-size="11" font-weight="bold">${encodeURIComponent(program)}</text></svg>`;

export const createMockIdBack = (id: string) =>
  `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250" viewBox="0 0 400 250"><rect width="400" height="250" rx="14" fill="%230F172A"/><rect x="15" y="15" width="370" height="220" rx="10" fill="%23F8FAFC"/><rect x="35" y="35" width="330" height="40" rx="6" fill="%231E293B"/><text x="200" y="60" fill="%23FFFFFF" font-family="sans-serif" font-size="10" font-weight="bold" text-anchor="middle">|||| | ||||| ||| ||||||| | |||| ||||| ${encodeURIComponent(id)}</text><text x="35" y="100" fill="%23475569" font-family="sans-serif" font-size="9" font-weight="bold">TERMS & CONDITIONS</text><text x="35" y="118" fill="%2364748B" font-family="sans-serif" font-size="8">This card is non-transferable and must be presented upon request.</text><text x="35" y="132" fill="%2364748B" font-family="sans-serif" font-size="8">Loss of this card must be reported immediately to the Registrar.</text><rect x="35" y="150" width="330" height="65" rx="6" fill="%23EFF6FF" stroke="%23BFDBFE"/><text x="200" y="175" fill="%231D4ED8" font-family="sans-serif" font-size="10" font-weight="bold" text-anchor="middle">EMERGENCY CONTACT & VALIDATION</text><text x="200" y="195" fill="%23334155" font-family="sans-serif" font-size="9" text-anchor="middle">Garcia College of Technology Registrar Office</text></svg>`;

export const createMockSelfie = (name: string) =>
  `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" rx="16" fill="%23F1F5F9"/><circle cx="150" cy="115" r="50" fill="%23CBD5E1"/><path d="M85 240 Q150 180 215 240" fill="%23CBD5E1"/><circle cx="150" cy="150" r="130" fill="none" stroke="%2322C55E" stroke-width="4" stroke-dasharray="8 6"/><rect x="30" y="255" width="240" height="32" rx="16" fill="%2316A34A"/><text x="150" y="276" fill="%23FFFFFF" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle">✓ Face Verified: ${encodeURIComponent(name)}</text></svg>`;

export const INITIAL_STUDENTS: Student[] = [];



export const INITIAL_CURRICULUM_SUBJECTS: CurriculumSubject[] = (() => {
  const subjects: CurriculumSubject[] = [];

  // Central prerequisite table — maps normalized subject code to prerequisite codes.
  // (Mirrors curriculumData.ts:standardPrereqs so both are in sync.)
  const prereqRegistry: Record<string, string[]> = {
    // BSIT
    'cw1':    ['Engl 1'],
    'hum1':   ['UTS 1'],
    'cc103':  ['CC 102'],
    'cc104':  ['CC 101'],
    'pe2':    ['PE 1'],
    'nstp2':  ['NSTP 1'],
    'sts2':   ['STS 1'],
    'cc105':  ['CC 103'],
    'cc106':  ['CC 103'],
    'it1':    ['CC 103'],
    'it2':    ['CC 104'],
    'it3':    ['CC 103'],
    'pe3':    ['PE 2'],
    'it4':    ['CC 106'],
    'it5':    ['IT 2'],
    'it6':    ['IT 2'],
    'it7':    ['Math 1'],
    'it8':    ['IT 3'],
    'ttrep1': ['IT 2'],
    'fili2':  ['Fili 1'],
    'rizal1': ['Histo 1'],
    'pe4':    ['PE 3'],
    'it9':    ['IT 5'],
    'it10':   ['IT 6'],
    'it11':   ['Ttrep 1'],
    'it12':   ['IT 6'],
    'it13':   ['IT 5'],
    'it14':   ['IT 6'],
    'math4':  ['Math 1'],
    'ite1':   ['IT 10'],
    'it15':   ['IT 14'],
    'it16':   ['Ethics 1'],
    'it17':   ['IT 12'],
    'it18':   ['Math 4'],
    'it19':   ['IT 10'],
    'ite2':   ['IT 11'],
    'cp1':    ['IT 15', 'IT 17'],
    'cp2':    ['CP 1'],
    'ite3':   ['IT 13'],
    'ite4':   ['IT 19'],
    'ite5':   ['IT E4'],
    'ojtit':  ['CP 2'],

    // BSCS
    'cs01':   ['Math 1 CS'],
    'cs1':    ['CC 103'],
    'cs2':    ['CC 103'],
    'cse1':   ['CC 104'],
    'cs3':    ['CC 105'],
    'cs4':    ['CS 1'],
    'cs5':    ['CC 105'],
    'cs6':    ['CS 1'],
    'cs7':    ['CS 2'],
    'cs8':    ['CS 7'],
    'cs9':    ['CS 7'],
    'cs10':   ['CS 4'],
    'cs11':   ['CS E1'],
    'cs12':   ['CS 5'],
    'cse2':   ['CS 4'],
    'cs13':   ['CS 12'],
    'cs14':   ['Ethics 1'],
    'cs15':   ['CS 10'],
    'cs16':   ['CS 6'],
    'cs17':   ['CS 12'],
    'cs18':   ['CS 8'],
    'cse3':   ['CS 17'],
    'cs19':   ['CS 7'],
    'cse4':   ['CS E2'],
    'cse5':   ['CS E4'],
    'ths1':   ['CS 10', 'CS 11'],
    'ths2':   ['THS 1'],
    'ojtcs':  ['THS 2']
  };

  function resolvePrereqList(subjCode: string): string {
    const p = prereqRegistry[normalizeSubjCode(subjCode)];
    return p && p.length > 0 ? p.join(', ') : 'None';
  }

  // BSIT curriculum entries
  GCT_CURRICULUM_BSIT.forEach((subj, idx) => {
    subjects.push({
      id: `cur-${subj.code}-BSIT-${idx}`,
      code: subj.code,
      title: subj.title,
      units: subj.units,
      lecUnits: subj.units > 2 ? Math.max(2, subj.units - 1) : subj.units,
      labUnits: subj.units > 2 ? 1 : 0,
      program: 'BSIT',
      year_level: subj.yearLevel,
      semester: subj.semester,
      prerequisites: resolvePrereqList(subj.code)
    });
  });

  // BSCS curriculum entries
  GCT_CURRICULUM_BSCS.forEach((subj, idx) => {
    subjects.push({
      id: `cur-${subj.code}-BSCS-${idx}`,
      code: subj.code,
      title: subj.title,
      units: subj.units,
      lecUnits: subj.units > 2 ? Math.max(2, subj.units - 1) : subj.units,
      labUnits: subj.units > 2 ? 1 : 0,
      program: 'BSCS',
      year_level: subj.yearLevel,
      semester: subj.semester,
      prerequisites: resolvePrereqList(subj.code)
    });
  });

  // BSBA core general education subjects
  const bsbaGenEds = GCT_CURRICULUM_BSIT.filter(s =>
    s.code.startsWith('C.O.') || s.code.startsWith('UTS') || s.code.startsWith('Histo') ||
    s.code.startsWith('Engl') || s.code.startsWith('Math') || s.code.startsWith('CW') ||
    s.code.startsWith('Hum') || s.code.startsWith('STS') || s.code.startsWith('PE') ||
    s.code.startsWith('NSTP') || s.code.startsWith('Fili') || s.code.startsWith('Rizal') ||
    s.code.startsWith('Ethics') || s.code.startsWith('Ttrep') || s.code.startsWith('SocSci')
  );
  bsbaGenEds.forEach((subj, idx) => {
    subjects.push({
      id: `cur-${subj.code}-BSBA-${idx}`,
      code: subj.code,
      title: subj.title,
      units: subj.units,
      lecUnits: subj.units,
      labUnits: 0,
      program: 'BSBA',
      year_level: subj.yearLevel,
      semester: subj.semester,
      prerequisites: resolvePrereqList(subj.code)
    });
  });

  return subjects;
})();

export const INITIAL_STAFF_ACCOUNTS: StaffAccount[] = [
  { id: 'staff-admin', email: 'admin@gct.edu.ph', name: 'System Administrator', role: 'registrar_admin', status: 'active' }
];

export const INITIAL_ACADEMIC_GRADES: AcademicGrade[] = [];

export const INITIAL_STUDENT_RECOMMENDATIONS: StudentRecommendationRecord[] = [];

export const INITIAL_CSV_PREVIEW_ROWS: CsvPreviewRow[] = [];

export const INITIAL_OCR_DETECTED_ROWS: OcrDetectedRow[] = [];

