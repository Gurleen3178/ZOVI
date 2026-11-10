
// =====================================
// ZOVI - SUPABASE CONNECTION
// =====================================

const SUPABASE_URL = "https://ckgoqszvfgzlpdnajbkv.supabase.co";

const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_HDLZRWhFlcsPAqmeWSF59A_NkcPlD8V";

// Create Supabase connection
const zoviSupabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

// Make connection available to other JS files
window.zoviSupabase = zoviSupabase;

console.log("ZOVI Supabase connection initialized.");
