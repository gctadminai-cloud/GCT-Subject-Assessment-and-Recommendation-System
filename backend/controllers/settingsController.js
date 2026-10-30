const { supabase } = require('../config/supabase');

async function getSettings(req, res) {
  try {
    const { data: settingsList, error } = await supabase
      .from('settings')
      .select('*');

    if (error) throw error;
    res.json(settingsList || []);
  } catch (error) {
    console.error('Get Settings Error:', error);
    res.status(500).json({ error: error.message });
  }
}

async function updateSetting(req, res) {
  try {
    const { key, value, description } = req.body;
    if (!key || value === undefined) {
      return res.status(400).json({ error: 'key and value are required' });
    }

    const valStr = String(value);
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('settings')
      .upsert([{ key, value: valStr, description: description || null }], { onConflict: 'key' });

    if (error) throw error;

    res.json({ message: `Setting '${key}' updated successfully`, key, value: valStr });
  } catch (error) {
    console.error('Update Setting Error:', error);
    res.status(500).json({ error: error.message });
  }
}

async function getPassingThreshold() {
  try {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'passing_grade_threshold')
      .limit(1);

    if (data?.[0]?.value) return Number(data[0].value);
  } catch (err) {
    console.warn('Error reading passing_grade_threshold from Supabase:', err.message);
  }
  return 75;
}

async function getMaxFailedPrereqs() {
  try {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'max_failed_prerequisites')
      .limit(1);

    if (data?.[0]?.value) return Number(data[0].value);
  } catch (err) {
    console.warn('Error reading max_failed_prerequisites from Supabase:', err.message);
  }
  return 3;
}

async function getAcademicYears(req, res) {
  try {
    const { data: gradeAYs } = await supabase
      .from('grade_records')
      .select('academic_year')
      .limit(100000)
      .not('academic_year', 'is', null);

    const { data: academicTerms } = await supabase
      .from('academic_records')
      .select('term')
      .limit(100000)
      .not('term', 'is', null);

    const { data: settingsData } = await supabase
      .from('settings')
      .select('key, value')
      .or('key.eq.available_academic_years,key.eq.activeAcademicYear');

    const aySet = new Set();

    (gradeAYs || []).forEach(g => {
      if (g.academic_year) aySet.add(String(g.academic_year).trim());
    });

    (academicTerms || []).forEach(r => {
      const match = String(r.term || '').match(/(\d{4}-\d{4})/);
      if (match && match[1]) aySet.add(match[1]);
    });

    let activeAYFromSettings = null;
    (settingsData || []).forEach(s => {
      if (s.key === 'available_academic_years' && s.value) {
        try {
          const arr = JSON.parse(s.value);
          if (Array.isArray(arr)) arr.forEach(ay => ay && aySet.add(String(ay).trim()));
        } catch (e) { }
      }
      if (s.key === 'activeAcademicYear' && s.value) {
        activeAYFromSettings = String(s.value).trim();
      }
    });

    const sortedArray = Array.from(aySet).sort((a, b) => {
      return parseInt(b.split('-')[0], 10) - parseInt(a.split('-')[0], 10);
    });

    res.json({
      academicYears: sortedArray,
      activeAcademicYear: activeAYFromSettings || sortedArray[0] || '2026-2027'
    });
  } catch (error) {
    console.error('Get Academic Years Error:', error);
    res.status(500).json({ error: error.message });
  }
}

async function addAcademicYear(req, res) {
  try {
    const { academic_year, setAsActive } = req.body;

    if (!academic_year || typeof academic_year !== 'string') {
      return res.status(400).json({ error: 'academic_year is required and must be a string' });
    }

    const ayRegex = /^(\d{4})-(\d{4})$/;
    const match = academic_year.trim().match(ayRegex);
    if (!match) {
      return res.status(400).json({ error: 'Invalid format. Expected YYYY-YYYY (ex: 2026-2027)' });
    }

    const firstYear = parseInt(match[1], 10);
    const secondYear = parseInt(match[2], 10);
    if (secondYear !== firstYear + 1) {
      return res.status(400).json({ error: 'Invalid year range: second year must be first year + 1' });
    }

    const trimmedAY = academic_year.trim();
    const { data: gradeAYs } = await supabase
      .from('grade_records')
      .select('academic_year')
      .limit(100000)
      .not('academic_year', 'is', null);

    const { data: academicTerms } = await supabase
      .from('academic_records')
      .select('term')
      .limit(100000)
      .not('term', 'is', null);

    const { data: settingsData } = await supabase
      .from('settings')
      .select('key, value')
      .or('key.eq.available_academic_years,key.eq.activeAcademicYear');

    const existingSet = new Set();

    (gradeAYs || []).forEach(g => {
      if (g.academic_year) existingSet.add(String(g.academic_year).trim());
    });

    (academicTerms || []).forEach(r => {
      const m = String(r.term || '').match(/(\d{4}-\d{4})/);
      if (m && m[1]) existingSet.add(m[1]);
    });

    (settingsData || []).forEach(s => {
      if (s.key === 'available_academic_years' && s.value) {
        try {
          const arr = JSON.parse(s.value);
          if (Array.isArray(arr)) arr.forEach(ay => ay && existingSet.add(String(ay).trim()));
        } catch (e) { }
      }
    });

    if (existingSet.has(trimmedAY)) {
      return res.status(400).json({ error: 'Duplicate academic year' });
    }

    let availableAYs = [];
    const existingAvailable = (settingsData || []).find(s => s.key === 'available_academic_years');
    if (existingAvailable?.value) {
      try {
        const parsed = JSON.parse(existingAvailable.value);
        if (Array.isArray(parsed)) availableAYs = parsed;
      } catch (e) { }
    }
    availableAYs.push(trimmedAY);
    const dedupedAYs = Array.from(new Set(availableAYs));

    const now = new Date().toISOString();
    await supabase
      .from('settings')
      .upsert([{
        key: 'available_academic_years',
        value: JSON.stringify(dedupedAYs),
        description: 'List of available academic years',
        created_at: now
      }], { onConflict: 'key' });

    if (setAsActive === true) {
      await supabase
        .from('settings')
        .upsert([{
          key: 'activeAcademicYear',
          value: trimmedAY,
          description: 'Currently active academic year',
          created_at: now
        }], { onConflict: 'key' });
    }

    res.status(201).json({
      message: 'Academic year added',
      academicYear: trimmedAY,
      setAsActive: !!setAsActive
    });
  } catch (error) {
    console.error('Add Academic Year Error:', error);
    res.status(500).json({ error: error.message });
  }
}

async function deleteAcademicYear(req, res) {
  try {
    const { academic_year } = req.params;
    if (!academic_year) {
      return res.status(400).json({ error: 'academic_year parameter is required' });
    }
    const trimmedAY = academic_year.trim();

    // Check if there are grade records for this academic year
    const { data: grades } = await supabase
      .from('grade_records')
      .select('id')
      .eq('academic_year', trimmedAY)
      .limit(1);

    if (grades && grades.length > 0) {
      return res.status(400).json({ error: `Cannot delete AY ${trimmedAY}: Grade records exist for this academic year.` });
    }

    const { data: settingsData } = await supabase
      .from('settings')
      .select('key, value')
      .or('key.eq.available_academic_years,key.eq.activeAcademicYear');

    let availableAYs = [];
    let activeAY = null;
    (settingsData || []).forEach(s => {
      if (s.key === 'available_academic_years' && s.value) {
        try {
          const arr = JSON.parse(s.value);
          if (Array.isArray(arr)) availableAYs = arr;
        } catch (e) { }
      }
      if (s.key === 'activeAcademicYear' && s.value) {
        activeAY = String(s.value).trim();
      }
    });

    const filteredAYs = availableAYs.filter(ay => ay !== trimmedAY);
    const now = new Date().toISOString();

    await supabase
      .from('settings')
      .upsert([{
        key: 'available_academic_years',
        value: JSON.stringify(filteredAYs),
        description: 'List of available academic years',
        created_at: now
      }], { onConflict: 'key' });

    if (activeAY === trimmedAY) {
      const fallbackActive = filteredAYs[0] || '2026-2027';
      await supabase
        .from('settings')
        .upsert([{
          key: 'activeAcademicYear',
          value: fallbackActive,
          description: 'Currently active academic year',
          created_at: now
        }], { onConflict: 'key' });
    }

    res.json({ message: `Academic Year ${trimmedAY} removed successfully` });
  } catch (error) {
    console.error('Delete Academic Year Error:', error);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  getSettings,
  updateSetting,
  getPassingThreshold,
  getMaxFailedPrereqs,
  getAcademicYears,
  addAcademicYear,
  deleteAcademicYear
};
