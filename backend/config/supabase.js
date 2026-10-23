const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const isLocalEnvironment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
const isSupabaseConfigured = Boolean(supabaseUrl && serviceRoleKey && !supabaseUrl.includes('your-supabase-project'));

if (!isSupabaseConfigured) {
  const message = 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required; the backend must not use the anon key for database access.';
  if (!isLocalEnvironment) throw new Error(message);
  console.warn(message);
}

const supabaseKey = serviceRoleKey || (isLocalEnvironment ? process.env.SUPABASE_ANON_KEY : null) || 'placeholder';
const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder',
  {
    auth: { persistSession: false, autoRefreshToken: false }
  }
);

module.exports = {
  supabase,
  supabaseUrl,
  isSupabaseConfigured
};
