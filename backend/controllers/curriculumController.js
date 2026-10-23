const { supabase } = require('../config/supabase');

async function getSubjects(req, res) {
  try {
    const { data: subjects, error } = await supabase
      .from('subjects')
      .select('*')
      .order('year_level', { ascending: true })
      .order('semester', { ascending: true })
      .order('code', { ascending: true });

    if (error) throw error;
    res.json(subjects || []);
  } catch (error) {
    console.error('Get Subjects Error:', error);
    res.status(500).json({ error: error.message });
  }
}

async function createSubject(req, res) {
  try {
    const { code, title, units, program, year_level, semester } = req.body;
    if (!code || !title) {
      return res.status(400).json({ error: 'Code and Title are required' });
    }

    const newSubject = {
      code: code.trim(),
      title: title.trim(),
      units: Number(units) || 3,
      program: program || 'BSIT',
      year_level: Number(year_level) || 1,
      semester: Number(semester) || 1,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('subjects')
      .insert([newSubject])
      .select('*');

    if (error) throw error;

    res.status(201).json(newSubject);
  } catch (error) {
    console.error('Create Subject Error:', error);
    res.status(500).json({ error: error.message });
  }
}

async function updateSubject(req, res) {
  try {
    const { id } = req.params;
    const { code, title, units, program, year_level, semester } = req.body;

    const { data: existingList } = await supabase
      .from('subjects')
      .select('*')
      .eq('id', id)
      .limit(1);

    const existing = existingList?.[0];
    if (!existing) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    const updated = {
      code: code !== undefined ? code : existing.code,
      title: title !== undefined ? title : existing.title,
      units: units !== undefined ? Number(units) : existing.units,
      program: program !== undefined ? program : existing.program,
      year_level: year_level !== undefined ? Number(year_level) : existing.year_level,
      semester: semester !== undefined ? Number(semester) : existing.semester
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

async function getPrerequisites(req, res) {
  try {
    const { data: prereqsData, error } = await supabase
      .from('prerequisites')
      .select('*');

    if (error) throw error;

    const { data: subjectsData } = await supabase
      .from('subjects')
      .select('*');

    const subMap = new Map((subjectsData || []).map(s => [s.id, s]));

    const prereqs = (prereqsData || []).map(r => {
      const s = subMap.get(r.subject_id);
      const ps = subMap.get(r.prerequisite_subject_id);
      return {
        id: r.id,
        subject_id: r.subject_id,
        prerequisite_subject_id: r.prerequisite_subject_id,
        created_at: r.created_at,
        subject: s ? { id: s.id, code: s.code, title: s.title } : null,
        prerequisite: ps ? { id: ps.id, code: ps.code, title: ps.title } : null
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
  getPrerequisites,
  createPrerequisite,
  deletePrerequisite
};
