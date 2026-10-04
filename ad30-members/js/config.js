// =====================================================================
//  AD30 study-group site - SETTINGS
//  Replace the three PASTE_... values (see SETUP.md, steps 3 and 5).
//  These values are safe to publish: the publishable/anon key only
//  reaches what the database's Row Level Security allows.
//  NEVER put a "secret" or "service_role" key in this file.
// =====================================================================
window.AD30_CONFIG = {
  // Supabase > Project Settings > API Keys (or the "Connect" button)
  SUPABASE_URL: "https://wwmdvausfdqxcaaunnhu.supabase.co",            // e.g. https://abcdefghijklmnop.supabase.co
  SUPABASE_ANON_KEY: "sb_publishable_U0tSNLkDY1MTN8MBOmfvRg_LaWN2amk",  // publishable key "sb_publishable_..." (older projects: "anon" key "eyJ...")

  // Google Sheet > File > Share > Publish to web > (Videos tab) > CSV > copy link
  SHEET_CSV_URL: "PASTE_SHEET_CSV_URL",          // e.g. https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?gid=0&single=true&output=csv

  // Where this site lives. Magic-link emails bring people back here.
  // Must also be listed in Supabase > Authentication > URL Configuration.
  SITE_URL: "https://benji7891.github.io/ad30-members/",

  // Shown on the sign-in screen when someone isn't on the list yet.
  CONTACT_NAME: "Sam",

  // Group leaders who may open admin.html (lower case). This list only controls what the
  // PAGE shows; the database separately checks its own "admins" table (schema.sql section 9),
  // so keep both lists the same. Putting an email here alone grants no data access.
  ADMIN_EMAILS: ["benjiferguson@gmail.com", "shughes@jstrongindustries.com"]
};
