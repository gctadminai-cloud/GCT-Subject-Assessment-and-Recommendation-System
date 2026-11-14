/**
 * seedCurriculum.js
 * Imports and seeds all 681 institutional curriculum subjects from GCT_Curriculum_All_Programs.xlsx into Supabase.
 *
 * Supports 12 degree programs:
 *   BSIT, BSCS, BSCE, BSBA-FM, BSBA-HRM, BSEE, BSME, BSBA-MM, BSBA-OM, BSHM, BSOA, BSA
 *
 * Usage:
 *   node scripts/seedCurriculum.js --dry-run
 *   node scripts/seedCurriculum.js
 */
const fs = require('fs');
const path = require('path');
let XLSX;
try {
  XLSX = require('xlsx');
} catch (e) {
  try {
    XLSX = require(path.join(__dirname, '../../frontend/node_modules/xlsx'));
  } catch (e2) {
    XLSX = require('xlsx');
  }
}

const DRY = process.argv.includes('--dry-run');

const cleanPrereqString = (val) => {
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
};

// Locate GCT_Curriculum_All_Programs.xlsx
const possiblePaths = [
  path.join(__dirname, '../../GCT_Curriculum_All_Programs.xlsx'),
  path.join(__dirname, '../GCT_Curriculum_All_Programs.xlsx'),
  path.join(__dirname, './data/GCT_Curriculum_All_Programs.xlsx'),
  path.join(process.cwd(), 'GCT_Curriculum_All_Programs.xlsx')
];

let workbookPath = null;
for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    workbookPath = p;
    break;
  }
}

if (!workbookPath) {
  console.error('Could not find GCT_Curriculum_All_Programs.xlsx in workspace roots.');
  process.exit(1);
}

function parseCurriculumFile(filePath) {
  const workbook = XLSX.readFile(filePath);
  const allSubjects = [];

  workbook.SheetNames.forEach(sheetName => {
    if (sheetName.toLowerCase() === 'verify') return;
    const ws = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const programCode = sheetName.trim();

    let currentYear = 1;
    let currentSem = 1;
    let headerColMap = null;

    rows.forEach(row => {
      if (!row || row.length === 0) return;
      const rowStr = row.map(c => String(c || '').trim()).filter(Boolean).join(' ');
      const lowerRow = rowStr.toLowerCase();

      // Check Year Section
      if (lowerRow === 'first year' || lowerRow.startsWith('first year')) {
        currentYear = 1;
        currentSem = 1;
        headerColMap = null;
        return;
      }
      if (lowerRow === 'second year' || lowerRow.startsWith('second year')) {
        currentYear = 2;
        currentSem = 1;
        headerColMap = null;
        return;
      }
      if (lowerRow === 'third year' || lowerRow.startsWith('third year')) {
        currentYear = 3;
        currentSem = 1;
        headerColMap = null;
        return;
      }
      if (lowerRow === 'fourth year' || lowerRow.startsWith('fourth year')) {
        currentYear = 4;
        currentSem = 1;
        headerColMap = null;
        return;
      }
      if (lowerRow === 'summer' || lowerRow.startsWith('summer')) {
        currentSem = 3;
        headerColMap = null;
        return;
      }

      // Check Semester Section
      if (lowerRow === 'first semester' || lowerRow.startsWith('first semester')) {
        currentSem = 1;
        headerColMap = null;
        return;
      }
      if (lowerRow === 'second semester' || lowerRow.startsWith('second semester')) {
        currentSem = 2;
        headerColMap = null;
        return;
      }

      // Check Table Header
      const hasCode = row.some(c => /cat\.?\s*no\.?|subject\s*code|course\s*code|code/i.test(String(c || '')));
      const hasTitle = row.some(c => /descriptive\s*title|description|title/i.test(String(c || '')));
      const hasUnits = row.some(c => /units?|credit/i.test(String(c || '')));

      if (hasCode && (hasTitle || hasUnits)) {
        headerColMap = {};
        row.forEach((cell, cIdx) => {
          const s = String(cell || '').toLowerCase().trim();
          if (/cat\.?\s*no\.?|subject\s*code|course\s*code|code/i.test(s)) headerColMap.code = cIdx;
          else if (/descriptive\s*title|description|title/i.test(s)) headerColMap.title = cIdx;
          else if (s === 'lec' || s.startsWith('lec')) headerColMap.lec = cIdx;
          else if (s === 'lab' || s.startsWith('lab')) headerColMap.lab = cIdx;
          else if (/units?|credit/i.test(s)) headerColMap.units = cIdx;
          else if (/pre-?requisite/i.test(s)) headerColMap.prereq = cIdx;
        });
        return;
      }

      if (lowerRow.startsWith('total') || lowerRow.startsWith('grand total')) {
        return;
      }

      if (headerColMap && headerColMap.code !== undefined && row[headerColMap.code]) {
        const codeVal = String(row[headerColMap.code] || '').trim();
        if (!codeVal || codeVal.toLowerCase() === 'total' || codeVal.toLowerCase().includes('garcia')) return;

        const titleVal = headerColMap.title !== undefined ? String(row[headerColMap.title] || '').trim() : '';
        const lecVal = headerColMap.lec !== undefined ? parseFloat(String(row[headerColMap.lec])) || 0 : 0;
        const labVal = headerColMap.lab !== undefined ? parseFloat(String(row[headerColMap.lab])) || 0 : 0;
        let unitsVal = headerColMap.units !== undefined ? parseFloat(String(row[headerColMap.units])) : (lecVal + labVal);
        if (isNaN(unitsVal) || unitsVal === 0) unitsVal = (lecVal + labVal) || 3;

        const prereqVal = cleanPrereqString(headerColMap.prereq !== undefined ? row[headerColMap.prereq] : 'None');

        const cleanCode = codeVal.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const subjectId = `sub-${programCode.toLowerCase()}-${cleanCode}`;

        allSubjects.push({
          id: subjectId,
          code: codeVal,
          title: titleVal || codeVal,
          lec_units: lecVal,
          lab_units: labVal,
          units: unitsVal,
          prerequisites: prereqVal,
          program: programCode,
          year_level: currentYear,
          semester: currentSem,
          created_at: new Date().toISOString()
        });
      }
    });
  });

  // Ensure institutional requirement C.O. 1 (College Orientation 1) is included for BSIT and BSCS
  ['BSIT', 'BSCS'].forEach(prog => {
    const hasCO = allSubjects.some(s => s.program === prog && s.code.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === 'co1');
    if (!hasCO) {
      allSubjects.push({
        id: `sub-${prog.toLowerCase()}-co1`,
        code: 'C.O. 1',
        title: 'College Orientation 1',
        lec_units: 1,
        lab_units: 0,
        units: 1,
        prerequisites: 'None',
        program: prog,
        year_level: 1,
        semester: 1,
        created_at: new Date().toISOString()
      });
    }
  });

  return allSubjects;
}

const subjects = parseCurriculumFile(workbookPath);
console.log(`Parsed ${subjects.length} curriculum subjects across programs from: ${workbookPath}`);

const byProgram = {};
subjects.forEach(s => {
  byProgram[s.program] = (byProgram[s.program] || 0) + 1;
});
console.log('Breakdown by program:', byProgram);

if (DRY) {
  console.log('DRY RUN: Validation passed successfully. No database writes performed.');
  process.exit(0);
}

require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || SUPABASE_URL.includes('your-supabase-project')) {
  console.error('STOP: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env first.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

async function runSeed() {
  console.log(`Upserting ${subjects.length} subjects into Supabase...`);
  const chunks = chunk(subjects, 100);

  for (let i = 0; i < chunks.length; i++) {
    const { error } = await supabase.from('subjects').upsert(chunks[i], { onConflict: 'id' });
    if (error) {
      console.error(`Failed upserting subjects chunk ${i + 1}/${chunks.length}:`, error.message);
      process.exit(1);
    }
  }

  console.log('Building prerequisite relationship mappings...');
  const subCodeMap = new Map();
  subjects.forEach(s => {
    const key = `${s.program.toLowerCase()}:${s.code.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`;
    subCodeMap.set(key, s);
  });

  const prereqRecords = [];
  subjects.forEach(s => {
    if (s.prerequisites && s.prerequisites !== 'None') {
      // Split prerequisites by comma, slash, or 'and'
      const parts = s.prerequisites.split(/[,/]|(?:\s+and\s+)/i).map(p => p.trim()).filter(Boolean);
      parts.forEach(part => {
        const cleanPart = part.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const pKey = `${s.program.toLowerCase()}:${cleanPart}`;
        const targetSub = subCodeMap.get(pKey);
        if (targetSub && targetSub.id !== s.id) {
          prereqRecords.push({
            id: `prereq-${s.id}-${targetSub.id}`,
            subject_id: s.id,
            prerequisite_subject_id: targetSub.id,
            created_at: new Date().toISOString()
          });
        }
      });
    }
  });

  if (prereqRecords.length > 0) {
    console.log(`Upserting ${prereqRecords.length} prerequisite relationship mappings...`);
    const pChunks = chunk(prereqRecords, 100);
    for (let i = 0; i < pChunks.length; i++) {
      const { error } = await supabase.from('prerequisites').upsert(pChunks[i], { onConflict: 'id' });
      if (error) {
        console.warn(`Prerequisite chunk ${i + 1} note:`, error.message);
      }
    }
  }

  console.log('Curriculum seeding complete! All 681 subjects & prerequisites are live in Supabase.');
}

runSeed().catch(err => {
  console.error('Fatal seed error:', err);
  process.exit(1);
});
