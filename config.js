// Konfigurasi Supabase.
// Pakai HANYA kunci anon/publishable. JANGAN pernah taruh service_role / secret key di sini.
window.APP_CONFIG = {
  SUPABASE_URL: 'https://dgkidrhzdufjbxqrrrxw.supabase.co',
  SUPABASE_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRna2lkcmh6ZHVmamJ4cXJycnh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4MzIwNDMsImV4cCI6MjEwODQwODA0M30.EkW7zgHmCyYEm2r3TI2Lw8UK0XadQY5m_0S1PNevwrE',
  // Alternatif kunci baru: 'sb_publishable_b6F_0xg_bcjA1y3C2wbYGQ_NHzTPBJr'
  BUCKET: 'transfer',
  MAX_MB: 50,
  LIMIT: 100,
  POLL_MS: 4000,
};
