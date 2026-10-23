export interface ProgramInfo {
  code: string;
  name: string;
  department: string;
  color: string;
  bgColor: string;
  description: string;
}

export interface Student {
  id: string;
  student_id: string;
  name: string;
  email: string;
  program: string;
  year: number;
  section: string;
  schedule?: string;
  semester?: number | string;
  status: 'approved' | 'pending' | 'unregistered';
  id_front_image?: string;
  id_back_image?: string;
  selfie_image?: string;
  created_at?: string;
  has_account?: boolean;
  verified?: boolean;
  has_deficiencies?: boolean;
  hasDeficiencies?: boolean;
  deficiency_count?: number;
  deficiencyCount?: number;
  course?: string;
}

export interface AcademicGradeAttempt {
  term: string;
  academicYear?: string;
  semester?: string;
  grade: number | string | null;
  rawGrade?: string | number | null;
  status: 'passed' | 'failed' | 'dropped';
}

export interface AcademicGrade {
  id: string;
  studentId: string;
  studentName: string;
  code: string;
  title: string;
  units: number;
  grade: number | string | null;
  term: string;
  academicYear?: string;
  semester?: string | number;
  yearLevel: number;
  status: 'passed' | 'failed' | 'pending' | 'dropped' | 'not_taken';
  rawGrade?: string | number | null;
  isDropped?: boolean;
  isRetake?: boolean;
  attemptCount?: number;
  attempts?: AcademicGradeAttempt[];
  curriculumTerm?: string;
  released?: boolean;
  releasedAt?: string;
  releasedBy?: string;
}

export interface CurriculumSubject {
  id: string;
  code: string;
  title: string;
  lecUnits: number;
  labUnits: number;
  units: number;
  program: string;
  year_level: number;
  semester: number;
  prerequisites: string;
}

export interface RecommendedSubjectItem {
  id: string;
  code: string;
  title: string;
  lecUnits: number;
  labUnits: number;
  totalUnits: number;
  prerequisites: string;
  isApproved?: boolean;
  remarks?: string;
}

export interface StudentRecommendationRecord {
  studentId: string;
  studentName: string;
  program: string;
  yearLevel: number;
  section: string;
  schedule: string;
  subjects: RecommendedSubjectItem[];
}

export interface StaffAccount {
  id: string;
  username?: string;
  email: string;
  name: string;
  role: 'registrar_staff' | 'registrar_admin';
  status: 'active' | 'inactive';
  department?: string;
  createdDate?: string;
  created_at?: string;
}

export interface CsvPreviewRow {
  id: string;
  studentId: string;
  name: string;
  course: string;
  year: number;
  code: string;
  title: string;
  units: number;
  grade: string | number;
  term: string;
  status: 'valid' | 'valid_pending' | 'will_update' | 'mismatch' | 'unrecognized' | 'invalid_grade';
  errorMsg: string;
}

export interface OcrDetectedRow {
  id: string;
  rawName: string;
  matchedStudentId: string;
  grade: number;
  code: string;
  term: string;
  status: 'matched' | 'unmatched';
  confidence: string;
}
