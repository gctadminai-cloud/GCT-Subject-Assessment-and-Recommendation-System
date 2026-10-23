import { describe, it, expect } from 'vitest';
import { supabase } from '../config/supabase.js';

describe('Supabase Database Verification', () => {
  it('should initialize profiles table with demo registrar admin', async () => {
    const { data: profiles, error } = await supabase.from('profiles').select('*');
    expect(error).toBeNull();
    expect(profiles.length).toBeGreaterThanOrEqual(1);

    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', 'demo-admin-id')
      .single();

    expect(adminProfile).toBeDefined();
    expect(adminProfile.role).toBe('registrar_admin');
    expect(adminProfile.full_name).toBe('System Administrator');
  });

  it('should query curriculum subjects and prerequisites', async () => {
    const { data: subjects } = await supabase
      .from('subjects')
      .select('*')
      .eq('program', 'BSIT');

    expect(subjects.length).toBeGreaterThan(0);

    const { data: prereqs } = await supabase
      .from('prerequisites')
      .select('*');

    expect(prereqs.length).toBeGreaterThan(0);
  });

  it('should read system settings from database', async () => {
    const { data: thresholdSetting } = await supabase
      .from('settings')
      .select('*')
      .eq('key', 'passing_grade_threshold')
      .single();

    expect(thresholdSetting).toBeDefined();
    expect(thresholdSetting.value).toBe('75');
  });
});
