// The site's forms (contact, collaborations, booking requests) post here
// (/api/forms). Each one is saved, then emailed to Orvella.

export const FORMS = {
  contact: 'New message from the contact form',
  collaborations: 'New collaboration request',
  reserve: 'New booking request'
};

const MAX_FIELDS = 30;
const MAX_LENGTH = 5000;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

function label(field) {
  const text = field.replace(/[_-]+/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function escape(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function submissionEmail(form, data) {
  const who = data.name || data.email || 'someone';
  const subject = FORMS[form] + ': ' + who;
  const rows = Object.entries(data);
  const text = rows.map(([k, v]) => label(k) + ': ' + v).join('\n');
  const html = '<div style="font-family:Helvetica,Arial,sans-serif;color:#5C3A43;font-size:15px;line-height:1.5">' +
    '<p style="margin:0 0 16px"><strong>' + escape(FORMS[form]) + '</strong></p>' +
    rows.map(([k, v]) => '<p style="margin:0 0 10px"><strong>' + escape(label(k)) + ':</strong><br>' +
      escape(v).replace(/\n/g, '<br>') + '</p>').join('') +
    '</div>';
  const replyTo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || '') ? data.email : undefined;
  return { subject, text, html, replyTo };
}

// save(form, data): stores it. notify(form, data): emails it (may be missing).
export function createFormsHandler({ save, notify, log = console.log }) {
  return async (req) => {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    let fields;
    try { fields = await req.formData(); } catch { return json({ error: 'Bad request' }, 400); }
    const form = String(fields.get('form-name') || '');
    if (!FORMS[form]) return json({ error: 'Unknown form' }, 404);
    if (fields.get('bot-field')) return json({ ok: true }); // a spam bot filled the hidden field

    const data = {};
    for (const [key, value] of fields) {
      if (key === 'form-name' || key === 'bot-field' || typeof value !== 'string') continue;
      if (Object.keys(data).length >= MAX_FIELDS) break;
      const text = value.trim().slice(0, MAX_LENGTH);
      if (text) data[key.slice(0, 50)] = text;
    }
    if (!Object.keys(data).length) return json({ error: 'Empty form' }, 400);

    await save(form, data);
    if (notify) {
      try { await notify(form, data); } catch (err) { log('forms: saved, but the email failed: ' + err.message); }
    }
    return json({ ok: true });
  };
}
