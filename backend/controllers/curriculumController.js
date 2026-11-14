const { supabase } = require('../config/supabase');

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

async function getSubjects(req, res) {
  try {
    let query = supabase
      .from('subjects')
      .select('*')
      .order('program', { ascending: true })
      .order('year_level', { ascending: true })
      .order('semester', { ascending: true })
      .order('code', { ascending: true })
      .range(0, 4999);

    if (req.query.program && req.query.program !== 'ALL') {
      query = query.eq('program', req.query.program);
    }
    if (req.query.year_level) {
      query = query.eq('year_level', Number(req.query.year_level));
    }
    if (req.query.semester) {
      query = query.eq('semester', Number(req.query.semester));
    }

    const { data: subjects, error } = await query;

    if (error) throw error;
    res.json(subjects || []);
  } catch (error) {
    console.error('Get Subjects Error:', error);
    res.status(500).json({ error: error.message });
  }
}

async function createSubject(req, res) {
  try {
    const { code, title, units, lec_units, lab_units, program, year_level, semester, prerequisites } = req.body;
    if (!code || !title) {
      return res.status(400).json({ error: 'Code and Title are required' });
    }

    const cleanCode = code.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const cleanProgram = (program || 'BSIT').trim();
    const subjectId = req.body.id || `sub-${cleanProgram.toLowerCase()}-${cleanCode}`;

    const lecUnits = Number(lec_units) || 0;
    const labUnits = Number(lab_units) || 0;
    const totalUnits = Number(units) || (lecUnits + labUnits) || 3;

    const newSubject = {
      id: subjectId,
      code: code.trim(),
      title: title.trim(),
      lec_units: lecUnits,
      lab_units: labUnits,
      units: totalUnits,
      program: cleanProgram,
      year_level: Number(year_level) || 1,
      semester: Number(semester) || 1,
      prerequisites: cleanPrereqString(prerequisites),
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('subjects')
      .upsert([newSubject], { onConflict: 'id' })
      .select('*');

    if (error) throw error;

    res.status(201).json(data?.[0] || newSubject);
  } catch (error) {
    console.error('Create Subject Error:', error);
    res.status(500).json({ error: error.message });
  }
}

async function updateSubject(req, res) {
  try {
    const { id } = req.params;
    const { code, title, units, lec_units, lab_units, program, year_level, semester, prerequisites } = req.body;

    const { data: existingList } = await supabase
      .from('subjects')
      .select('*')
      .eq('id', id)
      .limit(1);

    const existing = existingList?.[0];
    if (!existing) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    const lecUnits = lec_units !== undefined ? Number(lec_units) : (existing.lec_units || 0);
    const labUnits = lab_units !== undefined ? Number(lab_units) : (existing.lab_units || 0);
    const totalUnits = units !== undefined ? Number(units) : (existing.units || (lecUnits + labUnits) || 3);

    const updated = {
      code: code !== undefined ? code.trim() : existing.code,
      title: title !== undefined ? title.trim() : existing.title,
      units: totalUnits,
      lec_units: lecUnits,
      lab_units: labUnits,
      program: program !== undefined ? program.trim() : existing.program,
      year_level: year_level !== undefined ? Number(year_level) : existing.year_level,
      semester: semester !== undefined ? Number(semester) : existing.semester,
      prerequisites: prerequisites !== undefined ? cleanPrereqString(prerequisites) : cleanPrereqString(existing.prerequisites)
    };

    const { error } = await supabase
      .from('subjects')
      .update(updated)
      .eq('id', id);

    if (error) throw error;

    res.json({ id, ...updated });
  } catch (error) {
    console.error('Update Subject Error:', error);
    res.status(500).json({ error: error.message });
  }
}

async function deleteSubject(req, res) {
  try {
    const { id } = req.params;

    // Delete any dependent prerequisite relations
    await supabase.from('prerequisites').delete().or(`subject_id.eq.${id},prerequisite_subject_id.eq.${id}`);

    const { error } = await supabase
      .from('subjects')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ message: 'Subject deleted successfully' });
  } catch (error) {
    console.error('Delete Subject Error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Bulk import curriculum subjects and generate prerequisite relationships.
 * Supports multi-program curriculum ingestion into Supabase with automatic chunking.
 */
async function importCurriculumBatch(req, res) {
  try {
    const { subjects } = req.body;
    if (!Array.isArray(subjects) || subjects.length === 0) {
      return res.status(400).json({ error: 'No subjects provided for import' });
    }

    // 1. Normalize subjects
    const normalizedSubjects = subjects.map(s => {
      const code = String(s.code || '').trim();
      const program = String(s.program || 'BSIT').trim().toUpperCase();
      const cleanCode = code.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const id = s.id || `sub-${program.toLowerCase()}-${cleanCode}`;
      const lec_units = s.lec_units !== undefined ? Number(s.lec_units) : (s.lecUnits !== undefined ? Number(s.lecUnits) : 0);
      const lab_units = s.lab_units !== undefined ? Number(s.lab_units) : (s.labUnits !== undefined ? Number(s.labUnits) : 0);
      const units = s.units !== undefined ? Number(s.units) : (lec_units + lab_units || 3);

      return {
        id,
        code,
        title: String(s.title || code).trim(),
        lec_units,
        lab_units,
        units,
        prerequisites: cleanPrereqString(s.prerequisites),
        program,
        year_level: Number(s.year_level || s.yearLevel || 1),
        semester: Number(s.semester || 1),
        created_at: new Date().toISOString()
      };
    });

    // 2. Validate all subjects meet requirements (Cat. No., Descriptive Title, Lec, Lab, units, Pre-Requisite)
    const invalidRows = [];
    normalizedSubjects.forEach((s, idx) => {
      if (!s.code) {
        invalidRows.push(`Row ${idx + 1}: Missing Cat. No. (Subject Code)`);
      } else if (!s.title) {
        invalidRows.push(`Row ${idx + 1} (${s.code}): Missing Descriptive Title`);
      } else if (s.units === undefined || isNaN(s.units) || s.units < 0) {
        invalidRows.push(`Row ${idx + 1} (${s.code}): Invalid units value`);
      }
    });

    if (invalidRows.length > 0) {
      return res.status(400).json({
        error: `Curriculum Validation Failed: ${invalidRows.length} subject(s) did not meet standard requirements (Cat. No., Descriptive Title, Lec, Lab, units, Pre-Requisite).`,
        details: invalidRows.slice(0, 10)
      });
    }

    // 3. Chunk upsert subjects (100 per batch)
    const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));
    const subChunks = chunk(normalizedSubjects, 100);

    for (let i = 0; i < subChunks.length; i++) {
      const { error: subErr } = await supabase
        .from('subjects')
        .upsert(subChunks[i], { onConflict: 'id' });

      if (subErr) {
        console.error(`Curriculum import chunk ${i + 1} error:`, subErr);
        throw subErr;
      }
    }

    // 3. Resolve & upsert prerequisites
    const subCodeMap = new Map();
    normalizedSubjects.forEach(s => {
      const key = `${s.program.toLowerCase()}:${s.code.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`;
      subCodeMap.set(key, s);
    });

    const prereqRecords = [];
    normalizedSubjects.forEach(s => {
      if (s.prerequisites && s.prerequisites !== 'None') {
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
      const prereqChunks = chunk(prereqRecords, 100);
      for (let i = 0; i < prereqChunks.length; i++) {
        const { error: pErr } = await supabase
          .from('prerequisites')
          .upsert(prereqChunks[i], { onConflict: 'id' });
        if (pErr) {
          console.warn(`Prerequisite import chunk ${i + 1} warning:`, pErr.message);
        }
      }
    }

    // 4. Summarize programs
    const programCounts = {};
    normalizedSubjects.forEach(s => {
      programCounts[s.program] = (programCounts[s.program] || 0) + 1;
    });

    res.json({
      success: true,
      count: normalizedSubjects.length,
      prereqCount: prereqRecords.length,
      programs: programCounts,
      message: `Successfully imported ${normalizedSubjects.length} subjects and ${prereqRecords.length} prerequisite mappings across ${Object.keys(programCounts).length} degree programs.`
    });
  } catch (error) {
    console.error('Import Curriculum Error:', error);
    res.status(500).json({ error: error.message });
  }
}

async function getPrerequisites(req, res) {
  try {
    const { data: prereqsData, error } = await supabase
      .from('prerequisites')
      .select('*')
      .range(0, 4999);

    if (error) throw error;

    const { data: subjectsData } = await supabase
      .from('subjects')
      .select('id, code, title, program')
      .range(0, 4999);

    const subMap = new Map((subjectsData || []).map(s => [s.id, s]));

    const prereqs = (prereqsData || []).map(r => {
      const s = subMap.get(r.subject_id);
      const ps = subMap.get(r.prerequisite_subject_id);
      return {
        id: r.id,
        subject_id: r.subject_id,
        prerequisite_subject_id: r.prerequisite_subject_id,
        created_at: r.created_at,
        subject: s ? { id: s.id, code: s.code, title: s.title, program: s.program } : null,
        prerequisite: ps ? { id: ps.id, code: ps.code, title: ps.title, program: ps.program } : null
      };
    });

    res.json(prereqs);
  } catch (error) {
    console.error('Get Prerequisites Error:', error);
    res.status(500).json({ error: error.message });
  }
}

async function createPrerequisite(req, res) {
  try {
    const { subject_id, prerequisite_subject_id } = req.body;
    if (subject_id === prerequisite_subject_id) {
      return res.status(400).json({ error: 'A subject cannot be a prerequisite of itself' });
    }

    const newPrereq = {
      id: 'prereq-' + Date.now(),
      subject_id,
      prerequisite_subject_id,
      created_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('prerequisites')
      .insert([newPrereq]);

    if (error) throw error;

    res.status(201).json(newPrereq);
  } catch (error) {
    console.error('Create Prerequisite Error:', error);
    res.status(500).json({ error: error.message });
  }
}

async function deletePrerequisite(req, res) {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('prerequisites')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ message: 'Prerequisite mapping deleted' });
  } catch (error) {
    console.error('Delete Prerequisite Error:', error);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  importCurriculumBatch,
  getPrerequisites,
  createPrerequisite,
  deletePrerequisite
};
