// Mat map for events with assigned mats. Each taken mat is one entry in the
// Netlify Blobs store "mat-bookings", keyed "<event>/<mat>" (for example
// "sunrise-beach-pilates/B7"). To free a mat after a cancellation, delete
// that entry in the Netlify dashboard (Blobs > mat-bookings).

export const EVENTS = {
  'sunrise-beach-pilates': {
    rows: ['A', 'B', 'C'],
    perRow: 14,
    opens: Date.parse('2026-11-07T12:00:00Z'), // Sat, Nov 7, 7:00 AM Eastern (EST)
    maxPerBooking: 4
  }
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

function validMat(event, mat) {
  const m = /^([A-Z])(\d{1,2})$/.exec(mat);
  return !!m && event.rows.includes(m[1]) && +m[2] >= 1 && +m[2] <= event.perRow && String(+m[2]) === m[2];
}

async function takenMats(store, slug) {
  const { blobs } = await store.list();
  return blobs.filter((b) => b.key.startsWith(slug + '/')).map((b) => b.key.slice(slug.length + 1));
}

export function createHandler({ store, now = () => Date.now() }) {
  return async (req) => {
    const url = new URL(req.url);

    if (req.method === 'GET') {
      const slug = url.searchParams.get('event');
      if (!EVENTS[slug]) return json({ error: 'Unknown event' }, 404);
      return json({ taken: await takenMats(store, slug) });
    }

    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    let body;
    try { body = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }
    const slug = body && body.event;
    const event = EVENTS[slug];
    if (!event) return json({ error: 'Unknown event' }, 404);
    if (body['bot-field']) return json({ error: 'Bad request' }, 400);
    if (now() < event.opens) return json({ error: 'Booking is not open yet' }, 403);

    const mats = Array.isArray(body.mats) ? body.mats : [];
    const name = String(body.name || '').trim().slice(0, 200);
    const email = String(body.email || '').trim().slice(0, 200);
    if (!name || !email) return json({ error: 'Name and email are required' }, 400);
    if (mats.length < 1 || mats.length > event.maxPerBooking ||
        new Set(mats).size !== mats.length || !mats.every((m) => typeof m === 'string' && validMat(event, m))) {
      return json({ error: 'Please choose between 1 and ' + event.maxPerBooking + ' mats' }, 400);
    }

    const booking = JSON.stringify({
      name, email,
      phone: String(body.phone || '').trim().slice(0, 50),
      mats,
      at: new Date(now()).toISOString()
    });

    // Claim each mat only if nobody has it yet. If any is already taken,
    // give back the ones this request just claimed so it's all or nothing.
    // Claims go in seat order so two overlapping groups can't block each other.
    const claimed = [];
    const order = [...mats].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
    for (const mat of order) {
      const { modified } = await store.set(slug + '/' + mat, booking, { onlyIfNew: true });
      if (!modified) {
        await Promise.all(claimed.map((m) => store.delete(slug + '/' + m)));
        return json({ error: 'taken', mat, taken: await takenMats(store, slug) }, 409);
      }
      claimed.push(mat);
    }
    return json({ ok: true, mats });
  };
}
