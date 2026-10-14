// Favorite alerts: when booking opens for an event, everyone who hearted it
// gets one email from Orvella. Runs every 15 minutes (netlify/functions/favorite-alerts.mjs).
// Each sent email is remembered in the Netlify Blobs store "favorite-alerts",
// keyed "<event>/<member id>", so nobody gets the same alert twice.

// When booking opens for each event (UTC). When a "Coming soon" event gets its
// date, add it here with the same time as data-booking-opens on its page.
export const BOOKING_OPENS = {
  'sunrise-beach-pilates': '2026-10-31T11:00:00Z' // Sat, Oct 31, 7:00 AM Eastern
};

// Alerts only go out in the first 3 days after booking opens
const WINDOW = 3 * 24 * 60 * 60 * 1000;
const TIME_ZONE = 'America/New_York';
const LOGO = 'https://orvellawellness.com/assets/orvella-logo.jpg';

function escape(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function when(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const day = d.toLocaleDateString('en-US', { timeZone: TIME_ZONE, weekday: 'long', month: 'long', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { timeZone: TIME_ZONE, hour: 'numeric', minute: '2-digit' });
  return day + ' at ' + time;
}

export function alertEmail({ firstName, event, siteUrl }) {
  const link = siteUrl + '/events/' + event.id + '.html#reserve';
  const hi = firstName ? 'Hi ' + firstName + ',' : 'Hi there,';
  const date = when(event.starts_at);
  const details = [date, event.location].filter(Boolean).join(' · ');
  const subject = 'Booking is open: ' + event.title;
  const text = [
    hi, '',
    event.title + ', one of your favorite pop-ups, is now open for booking.',
    details, '',
    'Book your spot: ' + link, '',
    'xo, Orvella', '',
    "You're getting this because you hearted this pop-up on orvellawellness.com. " +
    'To stop these emails, untick "Email me when my favorites open for booking" in Edit profile on your account page.'
  ].filter((line, i, all) => line !== '' || all[i - 1] !== '').join('\n');
  const html =
    '<div style="background:#FBF7F2;padding:24px 12px;font-family:Helvetica,Arial,sans-serif;color:#5C3A43">' +
    '<div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #EADBD3;border-radius:16px;overflow:hidden">' +
    '<img src="' + LOGO + '" alt="Orvella" width="520" style="display:block;width:100%;height:auto">' +
    '<div style="padding:28px 28px 32px">' +
    '<p style="margin:0 0 16px;font-size:16px">' + escape(hi) + '</p>' +
    '<p style="margin:0 0 8px;font-size:16px;line-height:1.5"><strong>' + escape(event.title) + '</strong>, one of your favorite pop-ups, is now open for booking.</p>' +
    (details ? '<p style="margin:0 0 24px;font-size:15px;color:#8C5B65">' + escape(details) + '</p>' : '') +
    '<p style="margin:0 0 28px"><a href="' + escape(link) + '" style="display:inline-block;background:#8C5B65;color:#ffffff;text-decoration:none;padding:13px 26px;border-radius:999px;font-size:14px;letter-spacing:0.12em;text-transform:uppercase">Book your spot</a></p>' +
    '<p style="margin:0;font-size:16px;font-style:italic">xo, Orvella</p>' +
    '</div></div>' +
    '<p style="max-width:520px;margin:16px auto 0;font-size:12px;line-height:1.5;color:#8C5B65;text-align:center">' +
    "You're getting this because you hearted this pop-up on orvellawellness.com. To stop these emails, untick " +
    '&ldquo;Email me when my favorites open for booking&rdquo; in <a href="' + escape(siteUrl) + '/account.html" style="color:#8C5B65">Edit profile</a>.</p>' +
    '</div>';
  return { subject, text, html };
}

// fetch: talks to Supabase with the service role key (server only).
// store: Netlify Blobs store. send({ to, subject, text, html }): sends one email.
export function createRunner({ supabaseUrl, serviceKey, siteUrl, store, send, fetch = globalThis.fetch, now = () => Date.now(), log = console.log }) {
  const headers = { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey };
  async function get(path) {
    const res = await fetch(supabaseUrl + path, { headers });
    if (!res.ok) throw new Error('Supabase ' + res.status + ' for ' + path.split('?')[0]);
    return res.json();
  }

  return async function run() {
    let sent = 0;
    for (const [slug, opens] of Object.entries(BOOKING_OPENS)) {
      const start = Date.parse(opens);
      if (now() < start || now() > start + WINDOW) continue;

      const [event] = await get('/rest/v1/events?select=id,title,starts_at,location&id=eq.' + encodeURIComponent(slug));
      if (!event) { log('favorite-alerts: no events row for ' + slug); continue; }
      const favorites = await get('/rest/v1/favorites?select=user_id&event_id=eq.' + encodeURIComponent(slug));

      for (const { user_id: userId } of favorites) {
        const key = slug + '/' + userId;
        if (await store.get(key)) continue; // already sent
        const user = await get('/auth/v1/admin/users/' + encodeURIComponent(userId));
        const meta = user.user_metadata || {};
        if (!user.email || !user.email_confirmed_at || meta.favorite_alerts === false) continue;
        try {
          await send({ to: user.email, ...alertEmail({ firstName: meta.first_name, event, siteUrl }) });
        } catch (err) {
          log('favorite-alerts: could not email a member about ' + slug + ': ' + err.message);
          continue; // tried again on the next run
        }
        await store.set(key, new Date(now()).toISOString());
        sent++;
      }
    }
    if (sent) log('favorite-alerts: sent ' + sent);
    return sent;
  };
}
