import { describe, it, expect } from 'vitest';
const {
  findMultipleTargetStudents,
  generateMultiStudentCsv,
  getStudentEnrollmentStatus,
  queryChatbot
} = require('../controllers/chatbotController');
const { evaluateStudent } = require('../services/assessmentEngine');

describe('Chatbot Multi-Student & Target Term Recommendations Tests', () => {
  describe('Multi-Student ID Extraction & Query', () => {
    it('finds multiple target students from comma-separated list of IDs', async () => {
      const mockSupabase = {
        from: (table) => ({
          select: () => ({
            or: (clause) => ({
              limit: () => {
                if (clause.includes('1111')) {
                  return { data: [{ id: '1111', student_id: '1111', name: 'John Doe', program: 'BSIT', year_level: 2 }] };
                }
                if (clause.includes('2222')) {
                  return { data: [{ id: '2222', student_id: '2222', name: 'Jane Smith', program: 'BSIT', year_level: 3 }] };
                }
                if (clause.includes('3333')) {
                  return { data: [{ id: '3333', student_id: '3333', name: 'Bob Dylan', program: 'BSCS', year_level: 1 }] };
                }
                return { data: [] };
              }
            }),
            ilike: () => ({ limit: () => ({ data: [] }) }),
            limit: () => ({ data: [] })
          })
        })
      };

      const students = await findMultipleTargetStudents('student id 1111,2222,3333 show me there record etc.', mockSupabase);
      expect(students.length).toBe(3);
      expect(students[0].student_id).toBe('1111');
      expect(students[1].student_id).toBe('2222');
      expect(students[2].student_id).toBe('3333');
    });

    it('ignores academic year patterns like 2024-2025 and only extracts real student IDs', async () => {
      const mockSupabase = {
        from: (table) => ({
          select: () => ({
            or: (clause) => ({
              limit: () => {
                if (clause.includes('10526')) {
                  return { data: [{ id: '10526', student_id: '10526', name: 'Chin-Chin Abayon', program: 'BSIT', year_level: 1 }] };
                }
                if (clause.includes('11630')) {
                  return { data: [{ id: '11630', student_id: '11630', name: 'Jhon Fritz Sesaldo', program: 'BSIT', year_level: 3 }] };
                }
                return { data: [] };
              }
            }),
            ilike: () => ({ limit: () => ({ data: [] }) }),
            limit: () => ({ data: [] })
          })
        })
      };

      const students = await findMultipleTargetStudents('show grades for 10526, 11630 for academic year 2025-2026', mockSupabase);
      expect(students.length).toBe(2);
      expect(students.map(s => s.student_id)).toEqual(['10526', '11630']);
    });
  });

  describe('Multi-Student Excel / CSV Formatting with Spacing', () => {
    it('generates multi-student CSV with empty spacer rows between consecutive students', () => {
      const mockStudentsData = [
        {
          student: { id: '1111', student_id: '1111', name: 'Student One', program: 'BSIT', year_level: 2 },
          records: [
            { code: 'CC 101', title: 'Intro to Computing', units: 3, grade: 1.5, status: 'passed', term: '2024-2025 1st Sem' },
            { code: 'CC 102', title: 'Prog 1', units: 3, grade: 1.75, status: 'passed', term: '2024-2025 1st Sem' }
          ],
          gwa: '1.63',
          recommendations: [
            { code: 'IT 4', title: 'Info Management 2', units: 3, reason: 'regular', notes: 'Prerequisites cleared' }
          ],
          targetTermText: '2nd Year • 1st Sem',
          enrollmentStatus: { statusLabel: 'Active (Last enrolled: 2024-2025 1st Sem)', lastEnrolledTerm: '2024-2025 1st Sem' }
        },
        {
          student: { id: '2222', student_id: '2222', name: 'Student Two', program: 'BSIT', year_level: 3 },
          records: [
            { code: 'IT 10', title: 'Systems Analysis', units: 3, grade: 2.0, status: 'passed', term: '2025-2026 1st Sem' }
          ],
          gwa: '2.00',
          recommendations: [
            { code: 'IT 15', title: 'Architecture 2', units: 3, reason: 'regular', notes: 'Prerequisites cleared' }
          ],
          targetTermText: '3rd Year • 2nd Sem',
          enrollmentStatus: { statusLabel: 'Active (Last enrolled: 2025-2026 1st Sem)', lastEnrolledTerm: '2025-2026 1st Sem' }
        }
      ];

      const csvOutput = generateMultiStudentCsv(mockStudentsData);

      // Verify header and both students exist
      expect(csvOutput).toContain('MULTI-STUDENT ACADEMIC REPORT');
      expect(csvOutput).toContain('STUDENT #1:');
      expect(csvOutput).toContain('STUDENT #2:');
      expect(csvOutput).toContain('Student One');
      expect(csvOutput).toContain('Student Two');
      expect(csvOutput).toContain('CC 101');
      expect(csvOutput).toContain('IT 10');

      // Verify spacing: there must be consecutive blank lines (\r\n\r\n\r\n or empty entries) between students
      expect(csvOutput).toMatch(/CC 102.*?(\r?\n){2,}.*?STUDENT #2:/s);
    });
  });

  describe('Student Enrollment Status & Lapsed / Stopped Detection', () => {
    it('detects active status when recent grade record matches active academic year', () => {
      const student = { student_id: '12718', year_level: 2 };
      const records = [
        { term: '2025-2026 1st Sem', academic_year: '2025-2026', semester: '1' },
        { term: '2026-2027 1st Sem', academic_year: '2026-2027', semester: '1' }
      ];

      const status = getStudentEnrollmentStatus(student, records, '2026-2027');
      expect(status.isStoppedOrLapsed).toBe(false);
      expect(status.lastEnrolledTerm).toBe('2026-2027 1st Sem');
      expect(status.statusLabel).toContain('Active');
    });

    it('detects inactive / stopped status when student has a >= 2 year enrollment gap', () => {
      const student = { student_id: '9999', year_level: 2 };
      const records = [
        { term: '2023-2024 1st Sem', academic_year: '2023-2024', semester: '1' }
      ];

      const status = getStudentEnrollmentStatus(student, records, '2026-2027');
      expect(status.isStoppedOrLapsed).toBe(true);
      expect(status.lastEnrolledTerm).toBe('2023-2024 1st Sem');
      expect(status.statusLabel).toContain('Inactive / Stopped');
    });
  });

  describe('evaluateStudent Target Term Override', () => {
    it('evaluates recommendations for explicitly requested target year and semester', () => {
      const curriculumSubjects = [
        { id: 1, code: 'CC 101', title: 'Intro', year_level: 1, semester: 1, units: 3, program: 'BSIT' },
        { id: 2, code: 'CC 102', title: 'Prog 1', year_level: 1, semester: 1, units: 3, program: 'BSIT' },
        { id: 3, code: 'IT 4', title: 'Database 2', year_level: 2, semester: 2, units: 3, program: 'BSIT' },
        { id: 4, code: 'IT 5', title: 'Security 1', year_level: 2, semester: 2, units: 3, program: 'BSIT' }
      ];
      const studentGrades = [
        { subject_id: 1, code: 'CC 101', grade: 1.5, status: 'passed' },
        { subject_id: 2, code: 'CC 102', grade: 1.5, status: 'passed' }
      ];

      const res = evaluateStudent({
        studentGrades,
        curriculumSubjects,
        prerequisites: [],
        studentInfo: { year_level: 1, semester: 1, program: 'BSIT' },
        targetYearOverride: 2,
        targetSemesterOverride: 2
      });

      expect(res.targetTerm.year_level).toBe(2);
      expect(res.targetTerm.semester).toBe(2);
      expect(res.recommendedSubjects.some(s => s.code === 'IT 4')).toBe(true);
      expect(res.recommendedSubjects.some(s => s.code === 'IT 5')).toBe(true);
    });
  });

  describe('Single-Student Target Term Recommendation Query End-to-End', () => {
    it('does NOT reject a target term recommendation query when past grades do not exist for that upcoming term', async () => {
      // Mock student 12718 who finished 1st Year (2025-2026) and 2nd Year 1st Sem (2026-2027 1st Sem).
      // When user asks "give me the subject recommendation of studentid 12718 for second year second sem",
      // the system should NOT abort with "No recorded grades found for 2nd Year 2nd Sem"!
      const mockSupabase = {
        from: (table) => {
          if (table === 'students') {
            return {
              select: () => ({
                or: () => ({
                  limit: () => ({
                    data: [{ id: '12718', student_id: '12718', name: 'Arevalo, Mark Lester Palmon', program: 'BSIT', year_level: 2 }]
                  })
                }),
                ilike: () => ({ limit: () => ({ data: [] }) }),
                limit: () => ({ data: [] })
              })
            };
          }
          if (table === 'subjects') {
            return {
              select: () => ({
                eq: () => ({
                  order: () => ({
                    order: () => ({
                      data: [
                        { id: 10, code: 'Fili 2', title: 'Filipino sa Iba\'t Ibang Disiplina', year_level: 2, semester: 2, units: 3, program: 'BSIT' },
                        { id: 11, code: 'IT 4', title: 'Information Management 2', year_level: 2, semester: 2, units: 3, program: 'BSIT' },
                        { id: 12, code: 'IT 5', title: 'Information Assurance and Security 1', year_level: 2, semester: 2, units: 3, program: 'BSIT' }
                      ]
                    })
                  })
                })
              })
            };
          }
          if (table === 'prerequisites') {
            return {
              select: () => ({ data: [] })
            };
          }
          if (table === 'grade_records') {
            return {
              select: () => ({
                in: () => ({
                  order: () => ({
                    order: () => ({
                      data: [
                        { student_id: '12718', subject: 'CC 101', grade: '1.5', status: 'passed', term: '2025-2026 1st Sem' },
                        { student_id: '12718', subject: 'CC 102', grade: '1.5', status: 'passed', term: '2025-2026 1st Sem' },
                        { student_id: '12718', subject: 'CC 105', grade: '2.0', status: 'passed', term: '2026-2027 1st Sem' }
                      ]
                    })
                  })
                })
              })
            };
          }
          if (table === 'academic_records') {
            return {
              select: () => ({
                or: () => ({ data: [] })
              })
            };
          }
          if (table === 'settings') {
            return {
              select: () => ({
                in: () => ({
                  data: [
                    { key: 'activeAcademicYear', value: '2026-2027' }
                  ]
                }),
                eq: () => ({ limit: () => ({ data: [] }) }),
                data: []
              })
            };
          }
          if (table === 'chat_logs') {
            return {
              insert: () => ({ data: [] })
            };
          }
          return {
            select: () => ({
              eq: () => ({ limit: () => ({ data: [] }), data: [] }),
              limit: () => ({ data: [] }),
              data: []
            })
          };
        }
      };

      // Mock Express req and res
      const req = {
        body: {
          query: 'give me the subject recommendation of studentid 12718 for second year second sem',
          history: []
        },
        user: { role: 'admin', full_name: 'Registrar Admin' }
      };

      let jsonResponse = null;
      const res = {
        json: (payload) => {
          jsonResponse = payload;
          return payload;
        },
        status: () => res
      };

      // Mock supabase client via dependency injection
      const { supabase: realSupabase } = require('../config/supabase');
      // Execute queryChatbot with mockSupabase
      await queryChatbot(req, res, mockSupabase);

      expect(jsonResponse).not.toBeNull();
      // Crucial assertion: Must NOT be the "No recorded grades found" error!
      expect(jsonResponse.response).not.toContain('No recorded grades found');
      // Must contain subject recommendations table with 2nd Year 2nd Sem subjects!
      expect(jsonResponse.response).toContain('Recommended Subjects');
      expect(jsonResponse.response).toContain('Fili 2');
      expect(jsonResponse.response).toContain('IT 4');
      expect(jsonResponse.response).toContain('IT 5');
      // Must contain student enrollment status
      expect(jsonResponse.response).toContain('Enrollment Status');
      // Must attach Excel file export containing the exact Recommended Subjects table shown in response!
      expect(jsonResponse.file_export).not.toBeNull();
      expect(jsonResponse.file_export.format).toBe('excel');
      expect(jsonResponse.file_export.csv_data).toContain('RECOMMENDED SUBJECTS');
      expect(jsonResponse.file_export.csv_data).toContain('Fili 2');
      expect(jsonResponse.file_export.csv_data).toContain('IT 4');
    });

    it('asks a follow-up question when user asks for grades without specifying a term', async () => {
      const mockSupabase = {
        from: (table) => {
          if (table === 'students') {
            return {
              select: () => ({
                or: () => ({
                  limit: () => ({
                    data: [{
                      id: '12718',
                      student_id: '12718',
                      name: 'Arevalo, Mark Lester Palmon',
                      full_name: 'Arevalo, Mark Lester Palmon',
                      program: 'BSIT',
                      year_level: 2
                    }]
                  })
                }),
                ilike: () => ({ limit: () => ({ data: [] }) }),
                limit: () => ({ data: [] }),
                data: []
              })
            };
          }
          if (table === 'grade_records') {
            return {
              select: () => ({
                in: () => ({
                  order: () => ({
                    order: () => ({
                      data: [
                        { subject: 'CC 101', grade: 1.75, academic_year: '2024-2025', semester: '1', year_level: 1 },
                        { subject: 'CC 102', grade: 2.0, academic_year: '2024-2025', semester: '2', year_level: 1 },
                        { subject: 'CC 103', grade: 1.5, academic_year: '2025-2026', semester: '1', year_level: 2 }
                      ]
                    }),
                    data: []
                  }),
                  data: []
                })
              })
            };
          }
          if (table === 'academic_records' || table === 'recommendations') {
            return {
              select: () => ({
                or: () => ({ data: [] }),
                eq: () => ({ limit: () => ({ data: [] }), data: [] }),
                limit: () => ({ data: [] }),
                data: []
              })
            };
          }
          return {
            select: () => ({
              eq: () => ({ limit: () => ({ data: [] }), data: [] }),
              limit: () => ({ data: [] }),
              or: () => ({ data: [] }),
              in: () => ({
                order: () => ({
                  order: () => ({ data: [] }),
                  data: []
                }),
                data: []
              }),
              data: []
            })
          };
        }
      };

      const req = {
        body: {
          query: 'give me the grades of the student 12718',
          history: []
        },
        user: { role: 'admin', full_name: 'Registrar Admin' }
      };

      let jsonResponse = null;
      const res = {
        json: (payload) => {
          jsonResponse = payload;
          return payload;
        },
        status: () => res
      };

      await queryChatbot(req, res, mockSupabase);

      expect(jsonResponse).not.toBeNull();
      // Must NOT dump all grades immediately
      expect(jsonResponse.file_export).toBeNull();
      // Must ask a follow-up question
      expect(jsonResponse.response).toMatch(/Which academic term or semester's grades would you like to review|Aling academic year o semestre/i);
      // Must list recorded terms
      expect(jsonResponse.response).toContain('2024-2025 1st Sem');
      expect(jsonResponse.response).toContain('2024-2025 2nd Sem');
      expect(jsonResponse.response).toContain('2025-2026 1st Sem');
      expect(jsonResponse.response).toContain('All Terms');
      // Must provide available terms in student_action for UI pills
      expect(jsonResponse.student_action?.available_terms).toEqual([
        '2024-2025 1st Sem',
        '2024-2025 2nd Sem',
        '2025-2026 1st Sem'
      ]);
    });

    it('displays requested term grades and generates matching Excel file when user answers follow-up with a specific term', async () => {
      const mockSupabase = {
        from: (table) => {
          if (table === 'students') {
            return {
              select: () => ({
                or: () => ({
                  limit: () => ({
                    data: [{
                      id: '12718',
                      student_id: '12718',
                      name: 'Arevalo, Mark Lester Palmon',
                      full_name: 'Arevalo, Mark Lester Palmon',
                      program: 'BSIT',
                      year_level: 2
                    }]
                  })
                }),
                ilike: () => ({ limit: () => ({ data: [] }) }),
                limit: () => ({ data: [] }),
                data: []
              })
            };
          }
          if (table === 'grade_records') {
            return {
              select: () => ({
                in: () => ({
                  order: () => ({
                    order: () => ({
                      data: [
                        { subject: 'CC 101', grade: 1.75, academic_year: '2024-2025', semester: '1', year_level: 1 },
                        { subject: 'CC 102', grade: 2.0, academic_year: '2024-2025', semester: '2', year_level: 1 },
                        { subject: 'CC 103', grade: 1.5, academic_year: '2025-2026', semester: '1', year_level: 2 }
                      ]
                    }),
                    data: []
                  }),
                  data: []
                })
              })
            };
          }
          if (table === 'academic_records' || table === 'recommendations') {
            return {
              select: () => ({
                or: () => ({ data: [] }),
                eq: () => ({ limit: () => ({ data: [] }), data: [] }),
                limit: () => ({ data: [] }),
                data: []
              })
            };
          }
          return {
            select: () => ({
              eq: () => ({ limit: () => ({ data: [] }), data: [] }),
              limit: () => ({ data: [] }),
              or: () => ({ data: [] }),
              in: () => ({
                order: () => ({
                  order: () => ({ data: [] }),
                  data: []
                }),
                data: []
              }),
              data: []
            })
          };
        }
      };

      const req = {
        body: {
          query: '1st sem 2025-2026',
          history: [
            { sender: 'user', text: 'give me the grades of student 12718' },
            { sender: 'bot', text: 'Which academic term or semester\'s grades would you like to review for Arevalo, Mark Lester Palmon (12718)?' }
          ]
        },
        user: { role: 'admin', full_name: 'Registrar Admin' }
      };

      let jsonResponse = null;
      const res = {
        json: (payload) => {
          jsonResponse = payload;
          return payload;
        },
        status: () => res
      };

      await queryChatbot(req, res, mockSupabase);

      expect(jsonResponse).not.toBeNull();
      // Should display the grades table for 2025-2026 1st Sem
      expect(jsonResponse.response).toContain('Official Academic Record & Grade Sheet');
      expect(jsonResponse.response).toContain('CC 103');
      // Should NOT include CC 101 because it's filtered to 2025-2026 1st Sem
      expect(jsonResponse.response).not.toContain('CC 101');
      // Must generate matching Excel export for that term
      expect(jsonResponse.file_export).not.toBeNull();
      expect(jsonResponse.file_export.format).toBe('excel');
      expect(jsonResponse.file_export.csv_data).toContain('Student ID,Student Name,Program,Year Level,Subject Code,Subject Title,Units,Grade,Status,Academic Term');
      expect(jsonResponse.file_export.csv_data).toContain('2025-2026 1st Sem');
      expect(jsonResponse.file_export.csv_data).toContain('CC 103');
    });

    it('correctly recalls student 12310 from history and does not falsely match another student sharing first name when answering with 2025-2026 2nd Sem', async () => {
      const mockSupabase = {
        from: (table) => {
          if (table === 'students') {
            return {
              select: () => ({
                or: (clause) => ({
                  limit: () => {
                    if (clause.includes('12310')) {
                      return {
                        data: [{
                          id: '12310',
                          student_id: '12310',
                          name: 'Tolibas, Niño',
                          full_name: 'Tolibas, Niño',
                          program: 'BSIT',
                          year_level: 2
                        }]
                      };
                    }
                    if (clause.includes('13268')) {
                      return {
                        data: [{
                          id: '13268',
                          student_id: '13268',
                          name: 'NIÑO PRINCE JENO NABAYRA',
                          full_name: 'NIÑO PRINCE JENO NABAYRA',
                          program: 'BSIT',
                          year_level: 1
                        }]
                      };
                    }
                    return { data: [] };
                  }
                }),
                ilike: () => ({ limit: () => ({ data: [] }) }),
                limit: () => ({
                  data: [
                    { id: '13268', student_id: '13268', name: 'NIÑO PRINCE JENO NABAYRA', full_name: 'NIÑO PRINCE JENO NABAYRA', program: 'BSIT', year_level: 1 },
                    { id: '12310', student_id: '12310', name: 'Tolibas, Niño', full_name: 'Tolibas, Niño', program: 'BSIT', year_level: 2 }
                  ]
                }),
                data: []
              })
            };
          }
          if (table === 'grade_records') {
            return {
              select: () => ({
                in: () => ({
                  order: () => ({
                    order: () => ({
                      data: [
                        { subject: 'IT 201', grade: 1.75, academic_year: '2025-2026', semester: '1', year_level: 1 },
                        { subject: 'IT 202', grade: 2.0, academic_year: '2025-2026', semester: '2', year_level: 1 },
                        { subject: 'IT 301', grade: 1.5, academic_year: '2026-2027', semester: '1', year_level: 2 }
                      ]
                    }),
                    data: []
                  }),
                  data: []
                })
              })
            };
          }
          return {
            select: () => ({
              eq: () => ({ limit: () => ({ data: [] }), data: [] }),
              limit: () => ({ data: [] }),
              or: () => ({ data: [] }),
              in: () => ({
                order: () => ({
                  order: () => ({ data: [] }),
                  data: []
                }),
                data: []
              }),
              data: []
            })
          };
        }
      };

      const req = {
        body: {
          query: '2025-2026 2nd Sem',
          history: [
            { sender: 'user', text: 'give me the record of student 12310' },
            { sender: 'bot', text: 'Which academic term or semester\'s grades would you like to review for Tolibas, Niño ( 12310 )?', student_id: '12310' }
          ]
        },
        user: { role: 'admin', full_name: 'Registrar Admin' }
      };

      let jsonResponse = null;
      const res = {
        json: (payload) => {
          jsonResponse = payload;
          return payload;
        },
        status: () => res
      };

      await queryChatbot(req, res, mockSupabase);

      expect(jsonResponse).not.toBeNull();
      // Must target student 12310 (Tolibas, Niño), NEVER student 13268 (NIÑO PRINCE JENO NABAYRA)!
      expect(jsonResponse.response).toContain('12310');
      expect(jsonResponse.response).toContain('Tolibas, Niño');
      expect(jsonResponse.response).not.toContain('13268');
      expect(jsonResponse.response).not.toContain('NIÑO PRINCE JENO NABAYRA');
      // Must contain IT 202 (2025-2026 2nd Sem)
      expect(jsonResponse.response).toContain('IT 202');
    });

    it('safely distinguishes between Express next function and mock Supabase client', async () => {
      const expressNext = () => {};
      const req = {
        body: {
          query: '',
          history: []
        },
        user: { role: 'admin', full_name: 'Registrar Admin' }
      };

      let jsonResponse = null;
      let statusCalled = null;
      const res = {
        json: (p) => { jsonResponse = p; return p; },
        status: (s) => { statusCalled = s; return res; }
      };

      // When Express calls queryChatbot(req, res, next), customSupabase is expressNext function.
      // It should NOT throw 'supabase.from is not a function'!
      await queryChatbot(req, res, expressNext);
      expect(statusCalled).toBe(400);
      expect(jsonResponse.error).toBe('Query text is required');
    });
  });
});

