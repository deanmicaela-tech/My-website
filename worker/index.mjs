// The website on Cloudflare. Pages, images, CSS and JS are served as they are
// from the repo (see .assetsignore for what's left out); this Worker only
// handles the /api/ addresses and the every-15-minutes favorite alerts.
// Settings (Cloudflare > Workers & Pages > orvella > Settings > Variables and secrets):
//   SUPABASE_URL, SUPABASE_ANON_KEY    member accounts (public)
//   SUPABASE_SERVICE_ROLE_KEY          favorite alerts (secret)
//   SMTP_USER, SMTP_PASS               sending email through Gmail (SMTP_PASS secret)
//   NOTIFY_EMAIL                       where form submissions go (wrangler.toml)
import { WorkerMailer } from 'worker-mailer';
import { createHandler as createMatsHandler } from '../lib/mats-core.mjs';
import { createRunner } from '../lib/favorite-alerts-core.mjs';
import { createFormsHandler, submissionEmail } from '../lib/forms-core.mjs';
import { ensureSchema, d1Store, saveSubmission } from '../lib/d1-store.mjs';

const SITE_URL = 'https://orvellawellness.com';

function mailer(env) {
  if (!env.SMTP_USER || !env.SMTP_PASS) return null;
  const port = Number(env.SMTP_PORT || 465);
  const options = {
    host: env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: port === 465,
    startTls: port !== 465,
    authType: 'plain',
    credentials: { username: env.SMTP_USER, password: env.SMTP_PASS }
  };
  return ({ to, subject, text, html, replyTo }) => WorkerMailer.send(options, {
    from: { name: 'Orvella', email: env.SMTP_USER },
    to: { email: to },
    ...(replyTo ? { reply: { email: replyTo } } : {}),
    subject, text, html
  });
}

function config(env) {
  return new Response(JSON.stringify({
    supabaseUrl: env.SUPABASE_URL || '',
    supabaseAnonKey: env.SUPABASE_ANON_KEY || env.SUPABASE_ANON || ''
  }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' } });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/config') return config(env);
    if (pathname === '/api/mats') {
      await ensureSchema(env.DB);
      return createMatsHandler({ store: d1Store(env.DB, 'mat-bookings') })(request);
    }
    if (pathname === '/api/forms') {
      await ensureSchema(env.DB);
      const send = mailer(env);
      const to = env.NOTIFY_EMAIL || 'orvellawellness@gmail.com';
      return createFormsHandler({
        save: (form, data) => saveSubmission(env.DB, form, data),
        notify: send && ((form, data) => send({ to, ...submissionEmail(form, data) }))
      })(request);
    }
    if (pathname.endsWith('/')) { // folders show their index.html, like orvellawellness.com/
      const url = new URL(request.url);
      url.pathname += 'index.html';
      return env.ASSETS.fetch(new Request(url, request));
    }
    return env.ASSETS.fetch(request);
  },

  async scheduled(controller, env, ctx) {
    const send = mailer(env);
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !send) {
      console.log('favorite-alerts: not set up yet');
      return;
    }
    ctx.waitUntil(ensureSchema(env.DB).then(() => createRunner({
      supabaseUrl: env.SUPABASE_URL.replace(/\/$/, ''),
      serviceKey: env.SUPABASE_SERVICE_ROLE_KEY,
      siteUrl: SITE_URL,
      store: d1Store(env.DB, 'favorite-alerts'),
      send
    })()));
  }
};
