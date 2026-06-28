// ============================================================
//  STARBOUND CHRONICLES — Supabase Configuration
//
//  SETUP STEPS:
//  1. Go to https://supabase.com and create a free account
//  2. Click "New Project" — pick any region, set a DB password
//  3. Once created, go to: Project Settings > API
//  4. Copy "Project URL" and "anon public" key below
//  5. Go to: SQL Editor > New Query
//     Paste the contents of supabase/schema.sql and click Run
//  6. Done! Open auth.html in your browser.
// ============================================================

const SUPABASE_URL      = 'https://ztnrqrqfhoydwydtccqj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_GRmKn02xJlPgu1JpLTbWKQ_7yNcB2dj';

// Initialise the Supabase client (loaded via CDN in each HTML page)
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
