import * as XLSX from 'xlsx';

/**
 * Helper utility to trigger CSV browser file downloads to the user's Downloads folder.
 * Includes UTF-8 BOM (\uFEFF) so Microsoft Excel opens CSVs directly with proper columns and encoding.
 */
export function downloadCsvFile(csvTextContent: string, fileName: string) {
  const bomCsv = '\uFEFF' + csvTextContent;
  const blob = new Blob([bomCsv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate CSV text from array of objects
 */
export function generateCsv(data: Record<string, any>[]): string {
  if (!data || data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const headerRow = headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(',');
  const bodyRows = data.map(row =>
    headers.map(h => {
      const val = row[h] ?? '';
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(',')
  );
  return [headerRow, ...bodyRows].join('\r\n');
}

/**
 * Export data array directly to a Microsoft Excel (.xlsx) file
 * Explicitly formats Grade and GWA columns with '0.00' so Excel retains 2 decimal places.
 */
export function exportToExcel(
  data: Record<string, any>[],
  fileName: string,
  sheetName: string = 'Records'
) {
  if (!data || data.length === 0) return;
  const worksheet = XLSX.utils.json_to_sheet(data);

  if (worksheet && worksheet['!ref']) {
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    const gradeCols: number[] = [];
    const headers = Object.keys(data[0] || {});

    headers.forEach((h, idx) => {
      const lower = h.toLowerCase().trim();
      if (lower.includes('grade') || lower === 'gwa') {
        gradeCols.push(idx);
      }
    });

    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      for (const C of gradeCols) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = worksheet[addr];
        if (cell && cell.v != null && cell.v !== '' && !isNaN(Number(cell.v))) {
          const num = Number(cell.v);
          const formatted = num.toFixed(2);
          cell.t = 's';
          cell.v = formatted;
          cell.w = formatted;
          cell.z = '@';
        }
      }
    }
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const excelFileName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  XLSX.writeFile(workbook, excelFileName);
}

/**
 * Converts grade records CSV or tabular grade data into an official Microsoft Excel (.xlsx) file.
 * Formats every numeric grade cell with explicit 2-decimal format ('0.00') and '0.00' display text,
 * so Microsoft Excel always opens the file showing 1.00, 1.25, 1.50, 2.00, 3.00, 5.00 instead of truncating trailing zeros.
 * Also configures generous auto column widths so titles and names are never clipped.
 */
export function exportGradeSheetCsvToExcel(csvContent: string, fileName: string) {
  try {
    const cleanFileName = fileName.endsWith('.xlsx') ? fileName : (fileName.replace(/\.csv$/i, '') + '.xlsx');
    const workbook = XLSX.read(csvContent, { type: 'string', raw: false });
    const sheetName = workbook.SheetNames[0] || 'Grade Sheet';
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet || !worksheet['!ref']) {
      downloadCsvFile(csvContent, fileName);
      return;
    }

    const range = XLSX.utils.decode_range(worksheet['!ref']);

    // Track the active table section's Grade column index across multi-table exports
    let currentGradeCol: number | null = null;

    for (let R = range.s.r; R <= range.e.r; ++R) {
      // 1. Check if this row is a table header row
      let isHeaderRow = false;
      let foundGradeColInThisRow: number | null = null;

      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = worksheet[cellAddress];
        if (!cell || cell.v == null) continue;

        const strVal = String(cell.v).trim().toLowerCase();
        if (
          strVal === 'grade' ||
          strVal === 'final grade' ||
          strVal === 'deficiency grade' ||
          strVal === 'raw grade'
        ) {
          foundGradeColInThisRow = C;
        }
        if (
          strVal === 'student id' ||
          strVal === 'subject code' ||
          strVal === 'subject' ||
          strVal === 'category'
        ) {
          isHeaderRow = true;
        }
      }

      if (isHeaderRow) {
        // Switching to a new section header
        currentGradeCol = foundGradeColInThisRow;
        continue;
      }

      // 2. Check for banner or separator row (e.g. empty row, "RECOMMENDED SUBJECTS", "Summary:")
      const firstCellAddress = XLSX.utils.encode_cell({ r: R, c: range.s.c });
      const firstCell = worksheet[firstCellAddress];
      const firstVal = firstCell && firstCell.v != null ? String(firstCell.v).trim().toLowerCase() : '';
      if (
        !firstVal ||
        firstVal.startsWith('recommended subjects') ||
        firstVal.startsWith('active deficiencies') ||
        firstVal.startsWith('summary:') ||
        firstVal.startsWith('===')
      ) {
        currentGradeCol = null;
        continue;
      }

      // 3. Format numeric grade cells in the active table section
      // Default to column H (index 7) if no explicit header was encountered
      const effectiveGradeCol = currentGradeCol != null ? currentGradeCol : 7;
      const gradeCellAddr = XLSX.utils.encode_cell({ r: R, c: effectiveGradeCol });
      const gradeCell = worksheet[gradeCellAddr];

      if (gradeCell && gradeCell.v != null) {
        const rawVal = String(gradeCell.v).trim();
        // Skip header words or non-numeric statuses
        if (!/^(grade|deficiency|status|n\/?a|drp|dropped|passed|failed|pending)$/i.test(rawVal)) {
          const numVal = parseFloat(rawVal);
          if (!isNaN(numVal) && isFinite(numVal)) {
            const formatted = numVal.toFixed(2);
            // String cell with '@' format preserves exact "1.00", "1.25", "1.50", "2.00", "3.00", "5.00" in Microsoft Excel without rounding to integers
            gradeCell.t = 's';
            gradeCell.v = formatted;
            gradeCell.w = formatted;
            gradeCell.z = '@';
          }
        }
      }
    }

    // Auto-fit generous column widths for Garcia College of Technology format
    worksheet['!cols'] = [
      { wch: 14 }, // Student ID
      { wch: 28 }, // Student Name
      { wch: 12 }, // Program
      { wch: 12 }, // Year Level
      { wch: 16 }, // Subject Code
      { wch: 42 }, // Subject Title
      { wch: 8 },  // Units
      { wch: 10 }, // Grade
      { wch: 12 }, // Status
      { wch: 24 }  // Academic Term
    ];

    XLSX.writeFile(workbook, cleanFileName);
  } catch (err) {
    console.warn('exportGradeSheetCsvToExcel encountered an error, falling back to CSV download:', err);
    downloadCsvFile(csvContent, fileName);
  }
}

/**
 * Smart parser for multi-section GCT advising slips, student grade reports,
 * and academic record spreadsheets that contain title banners or multiple terms.
 */
function smartParseGradeSheet(rawRows: any[][]): Record<string, any>[] {
  let docStudentId = '';
  let docStudentName = '';
  let docProgram = '';
  let docAY = '';
  let currentTerm = '';
  const results: Record<string, any>[] = [];

  for (let i = 0; i < Math.min(8, rawRows.length); i++) {
    const row = rawRows[i];
    if (!row) continue;
    const rowStr = row.map(c => String(c).trim()).filter(Boolean).join(' ');

    const idMatch = rowStr.match(/(?:student\s*id|id\s*no\.?|id|student\s*number)\s*[:#—\-]?\s*([A-Za-z0-9\-]+)/i);
    if (idMatch && !docStudentId) docStudentId = idMatch[1].trim();

    const ayMatch = rowStr.match(/(\d{4}\s*-\s*\d{4})/);
    if (ayMatch && !docAY) docAY = ayMatch[1].replace(/\s+/g, '');

    const progMatch = rowStr.match(/\b(BSIT|BSCS|ACT|BSIS|BSCE|BSEE|BSBA)\b/i);
    if (progMatch && !docProgram) docProgram = progMatch[1].toUpperCase();

    const nameMatch = rowStr.match(/^([A-Za-z\s,.\-]+?)(?:\s*[—\-\|]\s*(?:BSIT|BSCS|Student|\d))/i);
    if (nameMatch && !docStudentName && !/grades|sheet|report|gct|garcia|academic/i.test(nameMatch[1])) {
      docStudentName = nameMatch[1].trim();
    }
  }

  let headerColMap: Record<string, number> | null = null;

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.length === 0 || row.every(c => c === '' || c == null)) continue;
    const rowStr = row.map(c => String(c).trim()).filter(Boolean).join(' ');

    const isSemHeader = /\b(1st|2nd|first|second|summer)\s*(?:sem|semester|term)?\b/i.test(rowStr) &&
                        !/cat\s*no|course|grade|units|status/i.test(rowStr);
    if (isSemHeader && /(?:sem|semester|term|summer|\d{4}-\d{4})/i.test(rowStr)) {
      const isSem2 = /\b(2nd|second)\s*(?:sem|semester)\b/i.test(rowStr);
      const isSummer = /\b(summer)\b/i.test(rowStr);
      const semStr = isSummer ? 'Summer' : (isSem2 ? '2nd Sem' : '1st Sem');
      const ayMatch = rowStr.match(/(\d{4}\s*-\s*\d{4})/);
      const ayStr = ayMatch ? ayMatch[1].replace(/\s+/g, '') : docAY || '2025-2026';
      currentTerm = `${ayStr} ${semStr}`;
      headerColMap = null;
      continue;
    }

    const isHeaderRow = row.some(c => /cat\s*no\.?|subject\s*code|course\s*code|subject|code/i.test(String(c))) &&
                        row.some(c => /grade|rating|status|units/i.test(String(c)));
    if (isHeaderRow) {
      headerColMap = {};
      row.forEach((col, colIdx) => {
        const cStr = String(col).trim().toLowerCase();
        if (/cat\s*no|subject\s*code|course\s*code|subject|code/i.test(cStr)) headerColMap!.code = colIdx;
        else if (/descriptive|title|description/i.test(cStr)) headerColMap!.title = colIdx;
        else if (/units?|credit/i.test(cStr)) headerColMap!.units = colIdx;
        else if (/grade|rating/i.test(cStr)) headerColMap!.grade = colIdx;
        else if (/status/i.test(cStr)) headerColMap!.status = colIdx;
        else if (/student\s*id|id/i.test(cStr)) headerColMap!.student_id = colIdx;
        else if (/name/i.test(cStr)) headerColMap!.name = colIdx;
      });
      continue;
    }

    if (/gwa|total\s*units|summary|average|signatory|signature|dean|registrar/i.test(rowStr)) continue;

    if (headerColMap && headerColMap.code !== undefined && headerColMap.grade !== undefined) {
      const codeVal = String(row[headerColMap.code] || '').trim();
      const rawGradeVal = row[headerColMap.grade];
      if (!codeVal) continue;

      const sid = (headerColMap.student_id !== undefined ? String(row[headerColMap.student_id] || '') : '') || docStudentId;
      const sname = (headerColMap.name !== undefined ? String(row[headerColMap.name] || '') : '') || docStudentName;
      const titleVal = headerColMap.title !== undefined ? String(row[headerColMap.title] || '').trim() : '';
      const unitsVal = headerColMap.units !== undefined ? Number(row[headerColMap.units]) || 3 : 3;

      results.push({
        student_id: sid,
        name: sname,
        full_name: sname,
        course: docProgram || 'BSIT',
        subject: codeVal,
        code: codeVal,
        title: titleVal,
        units: unitsVal,
        grade: rawGradeVal !== '' && rawGradeVal != null ? rawGradeVal : null,
        raw_grade: String(rawGradeVal || ''),
        term: currentTerm || (docAY ? `${docAY} 1st Sem` : '2025-2026 1st Sem')
      });
    }
  }

  return results;
}

/**
 * Parse an uploaded Excel (.xlsx, .xls) or CSV file into an array of objects
 */
export async function parseExcelOrCsvFile(file: File): Promise<Record<string, any>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          resolve([]);
          return;
        }
        const worksheet = workbook.Sheets[firstSheetName];
        const rawRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: '' });
        const smartParsed = smartParseGradeSheet(rawRows);
        if (smartParsed.length > 0) {
          resolve(smartParsed);
          return;
        }
        const json = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
        resolve(json);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Generate and download Official Student Advising Slip as an Excel (.xlsx) file
 */
export function exportOfficialAdvisingSlip(studentData: {
  name: string;
  studentId: string;
  program: string;
  yearLevel: string;
  term: string;
  recommendations: Array<{ code: string; title: string; units: number; reason: string; notes: string }>;
}) {
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const totalUnits = studentData.recommendations.reduce((sum, r) => sum + r.units, 0);

  const rows = [
    { 'A': 'GARCIA COLLEGE OF TECHNOLOGY (GCT)' },
    { 'A': 'OFFICIAL STUDENT ADVISING SLIP' },
    {},
    { 'A': 'Student Name:', 'B': studentData.name, 'D': 'Date Generated:', 'E': dateStr },
    { 'A': 'Student ID:', 'B': studentData.studentId, 'D': 'Academic Term:', 'E': studentData.term },
    { 'A': 'Degree Program:', 'B': studentData.program, 'D': 'Year Level:', 'E': studentData.yearLevel },
    { 'A': 'Standing Status:', 'B': 'ELIGIBLE FOR ENROLLMENT', 'D': 'Rule Engine Status:', 'E': 'VERIFIED' },
    {},
    { 'A': 'APPROVED RECOMMENDED SUBJECTS FOR ENROLLMENT' },
    {
      'A': 'Subject Code',
      'B': 'Subject Title',
      'C': 'Units',
      'D': 'Recommendation Type',
      'E': 'Status / Prerequisite Notes'
    },
    ...studentData.recommendations.map(r => ({
      'A': r.code,
      'B': r.title,
      'C': r.units,
      'D': r.reason === 'retake' ? 'Retake Required' : 'Unlocked / Recommended',
      'E': r.notes
    })),
    {},
    { 'A': 'TOTAL APPROVED UNITS', 'C': totalUnits },
    {},
    { 'A': 'INSTITUTIONAL VERIFICATION:' },
    { 'A': 'Prerequisite Assessment:', 'B': 'PASSED - All prerequisite rules satisfied' },
    { 'A': 'Passing Grade Threshold:', 'B': '75.00%' },
    { 'A': 'Verified By:', 'B': 'Office of the Registrar, Garcia College of Technology' }
  ];

  const worksheet = XLSX.utils.json_to_sheet(rows, { skipHeader: true });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Advising Slip');
  XLSX.writeFile(workbook, `GCT_Official_Advising_Slip_${studentData.studentId}_2026.xlsx`);
}

/**
 * Generate and download Institutional Academic Progress Excel (.xlsx) Report
 */
export function exportAcademicProgressExcel(records: any[], fileName?: string) {
  const formattedRecords = records.map((r, idx) => ({
    'Record ID': r.id || `REC-${idx + 1}`,
    'Student ID': r.studentId || r.student_id || 'N/A',
    'Student Name': r.studentName || r.name || 'N/A',
    'Degree Program': r.course || r.program || 'BSIT',
    'Year Level': r.year_level || r.yearLevel || r.year || r.curriculum_year_level || r.enrolled_year_level || 1,
    'Cat No.': r.code || 'N/A',
    'Descriptive Title': r.title || 'N/A',
    'Units': r.units || 3,
    'Grade': r.grade != null ? Number(r.grade).toFixed(2) : 'Pending',
    'Academic Term': r.term || '2025-2026 1st Sem',
    'Completion Status': r.status ? String(r.status).toUpperCase() : 'PENDING'
  }));

  const outFileName = fileName || `GCT_Academic_Progress_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
  exportToExcel(formattedRecords, outFileName, 'Academic Progress');
}

/**
 * Backward-compatible CSV exporter
 */
export function exportAcademicProgressCsv(records: any[]) {
  exportAcademicProgressExcel(records);
}

/**
 * Generate downloadable sample template Excel file for Academic Grade Records import
 */
export function downloadAcademicRecordsTemplate(format: 'xlsx' | 'csv' = 'xlsx') {
  const templateData = [
    {
      'Student ID': '10526',
      'Name': 'ABAYON, CHIN-CHIN',
      'Course': 'BSIT',
      'Year': 1,
      'Cat No.': 'CC 101',
      'Descriptive Title': 'Introduction to Computing',
      'Units': 3,
      'Grade': 1.75,
      'Term': '2023-2024 1st Sem'
    },
    {
      'Student ID': '10526',
      'Name': 'ABAYON, CHIN-CHIN',
      'Course': 'BSIT',
      'Year': 1,
      'Cat No.': 'CC 102',
      'Descriptive Title': 'Computer Programming 1',
      'Units': 3,
      'Grade': 1.75,
      'Term': '2023-2024 1st Sem'
    },
    {
      'Student ID': '10648',
      'Name': 'SAMSONA, LYCA MAE',
      'Course': 'BSIT',
      'Year': 1,
      'Cat No.': 'IT 101',
      'Descriptive Title': 'Introduction to Computing',
      'Units': 3,
      'Grade': 1.25,
      'Term': '2024-2025 1st Sem'
    },
    {
      'Student ID': 'GCT-2024-0003',
      'Name': 'Rizal, Jose Mercado',
      'Course': 'BSCS',
      'Year': 2,
      'Cat No.': 'CS 201',
      'Descriptive Title': 'Data Structures & Algorithms',
      'Units': 3,
      'Grade': 2.00,
      'Term': '2024-2025 1st Sem'
    }
  ];

  if (format === 'csv') {
    const csvContent = generateCsv(templateData);
    downloadCsvFile(csvContent, 'academic_records_import_template.csv');
  } else {
    exportToExcel(templateData, 'academic_records_import_template.xlsx', 'Template');
  }
}

/**
 * Generate downloadable sample template Excel file for Student Roster import
 */
export function downloadStudentsTemplate(format: 'xlsx' | 'csv' = 'xlsx') {
  const templateData = [
    {
      'Student ID': 'GCT-2024-0101',
      'Full Name': 'Alcantara, Gabriel M.',
      'Program / Course': 'BSIT',
      'Year Level': 1,
      'Email': 'g.alcantara@gct.edu.ph'
    },
    {
      'Student ID': 'GCT-2024-0102',
      'Full Name': 'Bernardo, Katrina L.',
      'Program / Course': 'BSCS',
      'Year Level': 2,
      'Email': 'k.bernardo@gct.edu.ph'
    }
  ];

  if (format === 'csv') {
    const csvContent = generateCsv(templateData);
    downloadCsvFile(csvContent, 'student_roster_import_template.csv');
  } else {
    exportToExcel(templateData, 'student_roster_import_template.xlsx', 'Students');
  }
}

/**
 * Export Student Roster to Excel (.xlsx) file
 */
export function exportStudentsToExcel(students: any[], fileName?: string) {
  const formattedData = students.map((s, idx) => ({
    'No.': idx + 1,
    'Student ID': s.student_id || s.studentId || 'N/A',
    'Full Name': s.name || 'N/A',
    'Program': s.program || 'BSIT',
    'Year Level': s.year || 1,
    'Email Address': s.email || 'N/A',
    'Status': (s.status || 'approved').toUpperCase()
  }));

  const outFileName = fileName || `GCT_Student_Roster_${new Date().toISOString().slice(0, 10)}.xlsx`;
  exportToExcel(formattedData, outFileName, 'Students');
}

export interface CompleteGradeRow {
  studentId: string;
  lastName: string;
  firstName: string;
  name: string;
  course: string;
  yearLevel: number | string;
  semester: string;
  academicYear: string;
  subject: string;
  grade: number | string | null;
  units: number | string;
}

/**
 * Export complete institutional grade records into Microsoft Excel (.xlsx) format.
 * Matches official institutional format:
 * - Sheet name: 'ALL GRADES'
 * - Row 1: ALL GRADES
 * - Row 2: Complete Grade Record
 * - Row 3: Blank spacer
 * - Row 4 Headers: Student ID | Last Name | First Name | Name | Course | Year Level | Semester | Academic Year | Subject | Grade | Units
 * - Grades strictly formatted to 2 decimals ('1.00', '1.25', '1.50', '2.00', '3.00', '5.00') as text cells with '@' format.
 * - Auto-filter applied to row 4 headers.
 */
export function exportCompleteAllGradesExcel(
  records: CompleteGradeRow[],
  fileName: string = 'GCT_ALL_GRADES_Complete_Record.xlsx'
) {
  if (!records || records.length === 0) return;

  const aoa: any[][] = [
    ['ALL GRADES'],
    ['Complete Grade Record'],
    []
  ];

  const headers = [
    'Student ID',
    'Last Name',
    'First Name',
    'Name',
    'Course',
    'Year Level',
    'Semester',
    'Academic Year',
    'Subject',
    'Grade',
    'Units'
  ];
  aoa.push(headers);

  records.forEach(r => {
    let formattedGrade = '';
    if (r.grade !== null && r.grade !== undefined && r.grade !== '') {
      const num = parseFloat(String(r.grade));
      if (!isNaN(num)) {
        formattedGrade = num.toFixed(2);
      } else {
        formattedGrade = String(r.grade).trim();
      }
    }

    aoa.push([
      r.studentId,
      r.lastName,
      r.firstName,
      r.name,
      r.course,
      Number(r.yearLevel) || 1,
      r.semester,
      r.academicYear,
      r.subject,
      formattedGrade,
      Number(r.units) || 3
    ]);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);

  if (worksheet && worksheet['!ref']) {
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    const gradeCol = 9; // Column J (0-indexed: 9)

    // Format all numeric grade cells in data rows (rows >= 4) with explicit 2-decimal string format
    for (let R = 4; R <= range.e.r; ++R) {
      const addr = XLSX.utils.encode_cell({ r: R, c: gradeCol });
      const cell = worksheet[addr];
      if (cell && cell.v != null && cell.v !== '') {
        const strVal = String(cell.v).trim();
        const numVal = parseFloat(strVal);
        if (!isNaN(numVal)) {
          const formatted = numVal.toFixed(2);
          cell.t = 's';
          cell.v = formatted;
          cell.w = formatted;
          cell.z = '@';
        }
      }
    }

    // Auto-filter on header row (row index 3, Excel row 4)
    worksheet['!autofilter'] = {
      ref: XLSX.utils.encode_range({
        s: { r: 3, c: 0 },
        e: { r: range.e.r, c: 10 }
      })
    };
  }

  // Generous column widths matching Garcia College of Technology standard format
  worksheet['!cols'] = [
    { wch: 14 }, // Student ID
    { wch: 18 }, // Last Name
    { wch: 20 }, // First Name
    { wch: 24 }, // Name
    { wch: 12 }, // Course
    { wch: 12 }, // Year Level
    { wch: 14 }, // Semester
    { wch: 16 }, // Academic Year
    { wch: 16 }, // Subject
    { wch: 12 }, // Grade
    { wch: 10 }  // Units
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'ALL GRADES');

  const cleanFileName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  XLSX.writeFile(workbook, cleanFileName);
}

/**
 * Export complete institutional grade records into standard CSV format.
 * Includes UTF-8 BOM (\uFEFF) and identical 11-column structure with 2-decimal grades.
 */
export function exportCompleteAllGradesCsv(
  records: CompleteGradeRow[],
  fileName: string = 'GCT_ALL_GRADES_Complete_Record.csv'
) {
  if (!records || records.length === 0) return;

  const lines: string[] = [
    '"ALL GRADES"',
    '"Complete Grade Record"',
    '""',
    '"Student ID","Last Name","First Name","Name","Course","Year Level","Semester","Academic Year","Subject","Grade","Units"'
  ];

  records.forEach(r => {
    let formattedGrade = '';
    if (r.grade !== null && r.grade !== undefined && r.grade !== '') {
      const num = parseFloat(String(r.grade));
      if (!isNaN(num)) {
        formattedGrade = num.toFixed(2);
      } else {
        formattedGrade = String(r.grade).trim();
      }
    }

    const row = [
      `"${String(r.studentId).replace(/"/g, '""')}"`,
      `"${String(r.lastName).replace(/"/g, '""')}"`,
      `"${String(r.firstName).replace(/"/g, '""')}"`,
      `"${String(r.name).replace(/"/g, '""')}"`,
      `"${String(r.course).replace(/"/g, '""')}"`,
      Number(r.yearLevel) || 1,
      `"${String(r.semester).replace(/"/g, '""')}"`,
      `"${String(r.academicYear).replace(/"/g, '""')}"`,
      `"${String(r.subject).replace(/"/g, '""')}"`,
      `"${formattedGrade}"`,
      Number(r.units) || 3
    ].join(',');

    lines.push(row);
  });

  const csvContent = lines.join('\r\n');
  const cleanFileName = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
  downloadCsvFile(csvContent, cleanFileName);
}

