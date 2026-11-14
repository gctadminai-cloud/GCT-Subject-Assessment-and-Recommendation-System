import * as XLSX from 'xlsx';
import type { CurriculumSubject } from '../modules/types';

export interface RequiredColumnsStatus {
  catNo: boolean;
  descriptiveTitle: boolean;
  lec: boolean;
  lab: boolean;
  units: boolean;
  preRequisite: boolean;
}

export interface ParsedCurriculumResult {
  subjects: CurriculumSubject[];
  programs: string[];
  programCounts: Record<string, number>;
  yearCounts: Record<number, number>;
  prerequisiteCount: number;
  detectedColumns: RequiredColumnsStatus;
  missingColumns: string[];
  isValid: boolean;
  validationErrors: string[];
  warnings: string[];
}

export function cleanPrerequisiteString(val: any): string {
  if (!val) return 'None';
  const str = String(val).trim();
  if (
    !str ||
    str === '-' ||
    str === '--' ||
    /^[*#\-~]+$/.test(str) ||
    /^(none|n\/a|na|nil|null|no\s*prereq.*)$/i.test(str)
  ) {
    return 'None';
  }
  return str;
}

/**
 * Parses an institutional curriculum file (.xlsx, .xls, .csv).
 * Supports:
 * 1. Multi-sheet workbooks (e.g. GCT_Curriculum_All_Programs.xlsx) where each sheet is a degree program.
 * 2. Section-based single-sheet formats with "FIRST YEAR", "First Semester", table headers.
 * 3. Flat tabular CSV/XLSX formats with columns: Program, Year, Semester, Code, Title, Lec, Lab, Units, Prerequisites.
 */
export async function parseCurriculumFile(file: File): Promise<ParsedCurriculumResult> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });

  const allSubjects: CurriculumSubject[] = [];
  const warnings: string[] = [];
  const programSet = new Set<string>();
  const programCounts: Record<string, number> = {};
  const yearCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  let prereqChainCount = 0;

  // Track required columns (Cat. No., Descriptive Title, Lec, Lab, units, Pre-Requisite)
  const detectedColumns: RequiredColumnsStatus = {
    catNo: false,
    descriptiveTitle: false,
    lec: false,
    lab: false,
    units: false,
    preRequisite: false
  };

  workbook.SheetNames.forEach(sheetName => {
    const cleanSheetName = sheetName.trim();
    if (cleanSheetName.toLowerCase() === 'verify') return;

    const ws = workbook.Sheets[sheetName];
    if (!ws) return;

    const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
    if (!rows || rows.length === 0) return;

    // Check if sheet is a flat tabular table with explicit 'Program' column in header
    const firstFewRows = rows.slice(0, 5);
    let flatHeaderIdx = -1;
    let flatHeaderMap: Record<string, number> | null = null;

    for (let i = 0; i < firstFewRows.length; i++) {
      const r = firstFewRows[i];
      if (!Array.isArray(r)) continue;
      const rStr = r.map(c => String(c || '').toLowerCase().trim());
      const hasCode = rStr.some(c => /cat\.?\s*no\.?|catalog\s*no\.?|subject\s*code|course\s*code|^code$/i.test(c));
      const hasProgram = rStr.some(c => /degree|program|course/i.test(c));
      if (hasCode && hasProgram) {
        flatHeaderIdx = i;
        flatHeaderMap = {};
        r.forEach((cell, idx) => {
          const s = String(cell || '').toLowerCase().trim();
          if (/cat\.?\s*no\.?|catalog\s*no\.?|subject\s*code|course\s*code|^code$/i.test(s)) {
            flatHeaderMap!.code = idx;
            detectedColumns.catNo = true;
          } else if (/descriptive\s*title|subject\s*title|course\s*title|description|^title$/i.test(s)) {
            flatHeaderMap!.title = idx;
            detectedColumns.descriptiveTitle = true;
          } else if (/degree|program/i.test(s)) {
            flatHeaderMap!.program = idx;
          } else if (/year|yr/i.test(s)) {
            flatHeaderMap!.year = idx;
          } else if (/sem|term/i.test(s)) {
            flatHeaderMap!.sem = idx;
          } else if (/^lec(?:\s*units?|\.?)?$|^lecture(?:\s*units?)?$/i.test(s)) {
            flatHeaderMap!.lec = idx;
            detectedColumns.lec = true;
          } else if (/^lab(?:\s*units?|\.?)?$|^laboratory(?:\s*units?)?$/i.test(s)) {
            flatHeaderMap!.lab = idx;
            detectedColumns.lab = true;
          } else if (/^(?:total\s*)?units?$|credits?|credit\s*units?/i.test(s)) {
            flatHeaderMap!.units = idx;
            detectedColumns.units = true;
          } else if (/pre-?requisites?|prereq/i.test(s)) {
            flatHeaderMap!.prereq = idx;
            detectedColumns.preRequisite = true;
          }
        });
        break;
      }
    }

    if (flatHeaderIdx !== -1 && flatHeaderMap && flatHeaderMap.code !== undefined) {
      // Process flat tabular format
      for (let i = flatHeaderIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        const codeVal = String(row[flatHeaderMap.code] || '').trim();
        if (!codeVal || codeVal.toLowerCase() === 'total' || codeVal.toLowerCase().includes('garcia')) continue;

        const progVal = flatHeaderMap.program !== undefined && row[flatHeaderMap.program]
          ? String(row[flatHeaderMap.program]).trim().toUpperCase()
          : cleanSheetName.toUpperCase();

        const titleVal = flatHeaderMap.title !== undefined ? String(row[flatHeaderMap.title] || '').trim() : codeVal;
        const yearVal = flatHeaderMap.year !== undefined ? parseInt(String(row[flatHeaderMap.year]), 10) || 1 : 1;
        const semRaw = flatHeaderMap.sem !== undefined ? String(row[flatHeaderMap.sem] || '1').toLowerCase() : '1';
        const semVal = semRaw.includes('summer') || semRaw === '3' ? 3 : semRaw.includes('2') || semRaw.includes('second') ? 2 : 1;

        const lecVal = flatHeaderMap.lec !== undefined ? parseFloat(String(row[flatHeaderMap.lec])) || 0 : 0;
        const labVal = flatHeaderMap.lab !== undefined ? parseFloat(String(row[flatHeaderMap.lab])) || 0 : 0;
        let unitsVal = flatHeaderMap.units !== undefined ? parseFloat(String(row[flatHeaderMap.units])) : (lecVal + labVal);
        if (isNaN(unitsVal) || unitsVal <= 0) unitsVal = (lecVal + labVal) || 3;

        const prereqVal = cleanPrerequisiteString(flatHeaderMap.prereq !== undefined ? row[flatHeaderMap.prereq] : 'None');

        const cleanCode = codeVal.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const id = `sub-${progVal.toLowerCase()}-${cleanCode}`;

        programSet.add(progVal);
        programCounts[progVal] = (programCounts[progVal] || 0) + 1;
        yearCounts[yearVal] = (yearCounts[yearVal] || 0) + 1;
        if (prereqVal !== 'None') prereqChainCount++;

        allSubjects.push({
          id,
          code: codeVal,
          title: titleVal,
          units: unitsVal,
          lecUnits: lecVal,
          labUnits: labVal,
          program: progVal,
          year_level: yearVal,
          semester: semVal,
          prerequisites: prereqVal
        });
      }
      return;
    }

    // Default: Section-based format (GCT Institutional Curriculum Matrix)
    const defaultProgram = cleanSheetName.toUpperCase();
    let currentYear = 1;
    let currentSem = 1;
    let sectionHeaderMap: Record<string, number> | null = null;

    rows.forEach(row => {
      if (!row || row.length === 0) return;
      const rowStr = row.map(c => String(c || '').trim()).filter(Boolean).join(' ');
      const lowerRow = rowStr.toLowerCase();

      // Check Year Section
      if (lowerRow === 'first year' || lowerRow.startsWith('first year')) {
        currentYear = 1;
        currentSem = 1;
        sectionHeaderMap = null;
        return;
      }
      if (lowerRow === 'second year' || lowerRow.startsWith('second year')) {
        currentYear = 2;
        currentSem = 1;
        sectionHeaderMap = null;
        return;
      }
      if (lowerRow === 'third year' || lowerRow.startsWith('third year')) {
        currentYear = 3;
        currentSem = 1;
        sectionHeaderMap = null;
        return;
      }
      if (lowerRow === 'fourth year' || lowerRow.startsWith('fourth year')) {
        currentYear = 4;
        currentSem = 1;
        sectionHeaderMap = null;
        return;
      }
      if (lowerRow === 'summer' || lowerRow.startsWith('summer')) {
        currentSem = 3;
        sectionHeaderMap = null;
        return;
      }

      // Check Semester Section
      if (lowerRow === 'first semester' || lowerRow.startsWith('first semester')) {
        currentSem = 1;
        sectionHeaderMap = null;
        return;
      }
      if (lowerRow === 'second semester' || lowerRow.startsWith('second semester')) {
        currentSem = 2;
        sectionHeaderMap = null;
        return;
      }

      // Detect Table Column Headers
      const hasCode = row.some(c => /cat\.?\s*no\.?|subject\s*code|course\s*code|^code$/i.test(String(c || '')));
      const hasTitle = row.some(c => /descriptive\s*title|description|^title$/i.test(String(c || '')));
      const hasUnits = row.some(c => /units?|credit/i.test(String(c || '')));

      if (hasCode && (hasTitle || hasUnits)) {
        sectionHeaderMap = {};
        row.forEach((cell, cIdx) => {
          const s = String(cell || '').toLowerCase().trim();
          if (/cat\.?\s*no\.?|catalog\s*no\.?|subject\s*code|course\s*code|^code$/i.test(s)) {
            sectionHeaderMap!.code = cIdx;
            detectedColumns.catNo = true;
          } else if (/descriptive\s*title|subject\s*title|course\s*title|description|^title$/i.test(s)) {
            sectionHeaderMap!.title = cIdx;
            detectedColumns.descriptiveTitle = true;
          } else if (/^lec(?:\s*units?|\.?)?$|^lecture(?:\s*units?)?$/i.test(s)) {
            sectionHeaderMap!.lec = cIdx;
            detectedColumns.lec = true;
          } else if (/^lab(?:\s*units?|\.?)?$|^laboratory(?:\s*units?)?$/i.test(s)) {
            sectionHeaderMap!.lab = cIdx;
            detectedColumns.lab = true;
          } else if (/^(?:total\s*)?units?$|credits?|credit\s*units?/i.test(s)) {
            sectionHeaderMap!.units = cIdx;
            detectedColumns.units = true;
          } else if (/pre-?requisites?|prereq/i.test(s)) {
            sectionHeaderMap!.prereq = cIdx;
            detectedColumns.preRequisite = true;
          }
        });
        return;
      }

      if (lowerRow.startsWith('total') || lowerRow.startsWith('grand total')) {
        return;
      }

      if (sectionHeaderMap && sectionHeaderMap.code !== undefined && row[sectionHeaderMap.code]) {
        const codeVal = String(row[sectionHeaderMap.code] || '').trim();
        if (!codeVal || codeVal.toLowerCase() === 'total' || codeVal.toLowerCase().includes('garcia')) return;

        const titleVal = sectionHeaderMap.title !== undefined ? String(row[sectionHeaderMap.title] || '').trim() : '';
        const lecVal = sectionHeaderMap.lec !== undefined ? parseFloat(String(row[sectionHeaderMap.lec])) || 0 : 0;
        const labVal = sectionHeaderMap.lab !== undefined ? parseFloat(String(row[sectionHeaderMap.lab])) || 0 : 0;
        let unitsVal = sectionHeaderMap.units !== undefined ? parseFloat(String(row[sectionHeaderMap.units])) : (lecVal + labVal);
        if (isNaN(unitsVal) || unitsVal <= 0) unitsVal = (lecVal + labVal) || 3;

        const prereqVal = cleanPrerequisiteString(sectionHeaderMap.prereq !== undefined ? row[sectionHeaderMap.prereq] : 'None');

        const cleanCode = codeVal.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const subjectId = `sub-${defaultProgram.toLowerCase()}-${cleanCode}`;

        programSet.add(defaultProgram);
        programCounts[defaultProgram] = (programCounts[defaultProgram] || 0) + 1;
        yearCounts[currentYear] = (yearCounts[currentYear] || 0) + 1;
        if (prereqVal !== 'None') prereqChainCount++;

        allSubjects.push({
          id: subjectId,
          code: codeVal,
          title: titleVal || codeVal,
          lecUnits: lecVal,
          labUnits: labVal,
          units: unitsVal,
          prerequisites: prereqVal,
          program: defaultProgram,
          year_level: currentYear,
          semester: currentSem
        });
      }
    });
  });

  if (allSubjects.length === 0) {
    warnings.push('No valid curriculum rows could be recognized in the uploaded file. Please verify sheet format.');
  }

  const missingColumns: string[] = [];
  if (!detectedColumns.catNo) missingColumns.push('Cat. No.');
  if (!detectedColumns.descriptiveTitle) missingColumns.push('Descriptive Title');
  if (!detectedColumns.lec) missingColumns.push('Lec');
  if (!detectedColumns.lab) missingColumns.push('Lab');
  if (!detectedColumns.units) missingColumns.push('units');
  if (!detectedColumns.preRequisite) missingColumns.push('Pre-Requisite');

  const validationErrors: string[] = [];
  if (missingColumns.length > 0) {
    validationErrors.push(`Required curriculum column(s) missing: ${missingColumns.join(', ')}. The file must contain: Cat. No., Descriptive Title, Lec, Lab, units, and Pre-Requisite.`);
  }

  if (allSubjects.length === 0) {
    validationErrors.push('No valid curriculum subjects could be recognized in the uploaded file.');
  }

  const isValid = missingColumns.length === 0 && allSubjects.length > 0 && validationErrors.length === 0;

  return {
    subjects: allSubjects,
    programs: Array.from(programSet),
    programCounts,
    yearCounts,
    prerequisiteCount: prereqChainCount,
    detectedColumns,
    missingColumns,
    isValid,
    validationErrors,
    warnings
  };
}

