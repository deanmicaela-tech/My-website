import { getStore } from '@netlify/blobs';
import nodemailer from 'nodemailer';
import { createRunner } from '../lib/favorite-alerts-core.mjs';

// Needs SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SMTP_USER and SMTP_PASS
// (see README.md > Favorite alerts). Until they are set, it does nothing.
export default async () => {
  const env = process.env;
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.SMTP_USER || !env.SMTP_PASS) {
    console.log('favorite-alerts: not set up yet');
    return;
  }
  const mail = nodemailer.createTransport({
    host: env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(env.SMTP_PORT || 465),
    secure: Number(env.SMTP_PORT || 465) === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS }
  });
  await createRunner({
    supabaseUrl: env.SUPABASE_URL.replace(/\/$/, ''),
    serviceKey: env.SUPABASE_SERVICE_ROLE_KEY,
    siteUrl: 'https://orvellawellness.com',
    store: getStore({ name: 'favorite-alerts', consistency: 'strong' }),
    send: (msg) => mail.sendMail({ from: { name: 'Orvella', address: env.SMTP_USER }, ...msg })
  })();
};

export const config = { schedule: '*/15 * * * *' };
