const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { supabase } = require('../config/supabase');

// GCT Curriculum reference (Year 1 subjects from curriculumData.ts)
const EXPECTED_YEAR1_SEM1 = ['C.O. 1','UTS 1','Histo 1','History 1','Engl 1','Math 1','CC 101','CC 102','PE 1','NSTP 1'];
const EXPECTED_YEAR1_SEM2 = ['CC 103','CC 104','CW 1','Hum 1','STS 1','Hum 2','PE 2','NSTP 2'];
const EXPECTED_YEAR2_SEM1 = ['CC 105','CC 106','IT 1','IT 2','IT 3','Fili 1','Ethics 1','STS 2','PE 3'];
const EXPECTED_YEAR2_SEM2 = ['Fili 2','Rizal 1','Ttrep 1','IT 4','IT 5','IT 6','IT 7','IT 8','PE 4'];

function normalizeSubjCode(str) {
  return String(str||'').replace(/[^a-zA-Z0-9]/g,'').toLowerCase();
}

async function main() {
  const { data: subjects } = await supabase.from('subjects').select('id, code, title, year_level, semester, program');
  
  console.log('=== Subjects with WRONG year_level or semester in DB ===\n');
  
  const toCheck = [
    ...EXPECTED_YEAR1_SEM1.map(c => ({ code: c, expectedYear: 1, expectedSem: 1 })),
    ...EXPECTED_YEAR1_SEM2.map(c => ({ code: c, expectedYear: 1, expectedSem: 2 })),
    ...EXPECTED_YEAR2_SEM1.map(c => ({ code: c, expectedYear: 2, expectedSem: 1 })),
    ...EXPECTED_YEAR2_SEM2.map(c => ({ code: c, expectedYear: 2, expectedSem: 2 })),
  ];

  const fixNeeded = [];
  
  for (const { code, expectedYear, expectedSem } of toCheck) {
    const norm = normalizeSubjCode(code);
    const matches = (subjects||[]).filter(s => normalizeSubjCode(s.code) === norm);
    
    if (matches.length === 0) {
      console.log(`  ❓ NOT FOUND: "${code}" (expected Year ${expectedYear} Sem ${expectedSem})`);
      continue;
    }
    
    for (const s of matches) {
      const wrong = s.year_level !== expectedYear || s.semester !== expectedSem;
      if (wrong) {
        console.log(`  ❌ WRONG: id="${s.id}" code="${s.code}" DB: year=${s.year_level} sem=${s.semester} → Expected: year=${expectedYear} sem=${expectedSem}`);
        fixNeeded.push({ id: s.id, code: s.code, year_level: expectedYear, semester: expectedSem, dbYear: s.year_level, dbSem: s.semester });
      } else {
        console.log(`  ✅ OK: code="${s.code}" year=${s.year_level} sem=${s.semester}`);
      }
    }
  }

  console.log(`\n=== Summary: ${fixNeeded.length} subjects need fixing ===`);
  fixNeeded.forEach(f => {
    console.log(`  "${f.code}" (id="${f.id}"): year ${f.dbYear}→${f.year_level}, sem ${f.dbSem}→${f.semester}`);
  });

  // Apply fix
  if (fixNeeded.length > 0) {
    console.log('\n=== Applying fixes... ===');
    for (const fix of fixNeeded) {
      const { error } = await supabase
        .from('subjects')
        .update({ year_level: fix.year_level, semester: fix.semester })
        .eq('id', fix.id);
      if (error) {
        console.log(`  ❌ Failed to fix "${fix.code}": ${error.message}`);
      } else {
        console.log(`  ✅ Fixed "${fix.code}" → year=${fix.year_level} sem=${fix.semester}`);
      }
    }
    console.log('\nFix complete! Restart the backend server to clear the subject cache.');
  } else {
    console.log('No fixes needed.');
  }
}

main().catch(console.error);

