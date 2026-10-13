// Public settings the account pages need to reach Supabase. Both values are
// meant to be public (Row Level Security in Supabase protects the data).
// Set them in Netlify > Project configuration > Environment variables:
//   SUPABASE_URL       e.g. https://abcdefgh.supabase.co
//   SUPABASE_ANON_KEY  Supabase > Project Settings > API keys > anon / publishable key
// Never put the service_role / secret key here.

export default () =>
  new Response(
    JSON.stringify({
      supabaseUrl: process.env.SUPABASE_URL || '',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ''
    }),
    { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' } }
  );

export const config = { path: '/api/config' };
