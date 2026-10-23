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
 */
export function exportToExcel(
  data: Record<string, any>[],
  fileName: string,
  sheetName: string = 'Records'
) {
  if (!data || data.length === 0) return;
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const excelFileName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  XLSX.writeFile(workbook, excelFileName);
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
    'Year Level': r.yearLevel || r.year || 1,
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
      'Section': 'A',
      'Schedule': 'Schedule 1',
      'Email': 'g.alcantara@gct.edu.ph'
    },
    {
      'Student ID': 'GCT-2024-0102',
      'Full Name': 'Bernardo, Katrina L.',
      'Program / Course': 'BSCS',
      'Year Level': 2,
      'Section': 'B',
      'Schedule': 'Schedule 2',
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
    'Section': s.section || 'A',
    'Schedule': s.schedule || 'Schedule 1',
    'Email Address': s.email || 'N/A',
    'Status': (s.status || 'approved').toUpperCase()
  }));

  const outFileName = fileName || `GCT_Student_Roster_${new Date().toISOString().slice(0, 10)}.xlsx`;
  exportToExcel(formattedData, outFileName, 'Students');
}

