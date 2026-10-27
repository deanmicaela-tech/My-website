// The account page: a member's numbers (classes attended and booked), their
// favorite pop-ups, and their profile. Logging in and signing up happen in the
// pop-up from js/member.js, which also provides Orvella.getClient and the form helpers.
(function () {
  var page = document.querySelector('.account-wrap');
  var Orvella = window.Orvella;
  if (!page || !Orvella) return;

  var forms = Orvella.forms;
  var views = page.querySelectorAll('[data-view]');
  var profileForm = page.querySelector('[data-profile]');
  var resetForm = page.querySelector('[data-reset]');
  var returnTo = location.origin + location.pathname;
  var client = null;

  function show(name) {
    views.forEach(function (v) { v.hidden = v.getAttribute('data-view') !== name; });
    page.querySelectorAll('.form-status').forEach(function (s) { s.textContent = ''; });
  }

  // ---------- Numbers and favorites ----------
  var TIME_ZONE = 'America/New_York';
  function dateParts(iso) {
    var parts = {};
    new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, month: 'short', day: 'numeric', weekday: 'short' })
      .formatToParts(new Date(iso)).forEach(function (p) { parts[p.type] = p.value; });
    return parts;
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function favoriteItem(ev) {
    var li = el('li', 'event');
    var date;
    if (ev.starts_at) {
      var d = dateParts(ev.starts_at);
      date = el('time', 'event-date');
      date.setAttribute('datetime', ev.starts_at);
      date.append(el('span', 'event-month', d.month), el('span', 'event-day', d.day), el('span', 'event-weekday', d.weekday));
    } else {
      date = el('p', 'event-date');
      date.append(el('span', 'event-month', 'Coming'), el('span', 'event-weekday', 'soon'));
    }
    var info = el('div', 'event-info');
    info.append(el('h3', null, ev.title));
    if (ev.location) info.append(el('p', 'event-meta', ev.location));
    var actions = el('div', 'event-actions');
    var heart = el('button', 'heart');
    heart.type = 'button';
    heart.setAttribute('aria-pressed', 'true');
    heart.setAttribute('aria-label', 'Remove ' + ev.title + ' from your favorites');
    heart.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 20s-7.5-4.6-7.5-10A4.25 4.25 0 0 1 12 7.2 4.25 4.25 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/></svg>';
    heart.addEventListener('click', function () {
      Orvella.setFavorite(ev.id, false).then(loadDashboard);
    });
    var link = el('a', 'btn btn-small btn-outline', 'View');
    link.href = 'events/' + ev.id + '.html';
    actions.append(heart, link);
    li.append(date, info, actions);
    return li;
  }

  // The home page decides which events are "Coming soon": those show no date or
  // place here either, even if Supabase still has an old one saved.
  var comingSoon = null;
  function loadComingSoon() {
    if (!comingSoon) {
      comingSoon = fetch('index.html').then(function (res) { return res.ok ? res.text() : ''; }).then(function (html) {
        var ids = {};
        new DOMParser().parseFromString(html, 'text/html').querySelectorAll('.event-list .event').forEach(function (li) {
          var heart = li.querySelector('[data-favorite]');
          if (heart && !li.querySelector('time.event-date')) ids[heart.getAttribute('data-favorite')] = true;
        });
        return ids;
      }).catch(function () { comingSoon = null; return {}; });
    }
    return comingSoon;
  }

  function loadDashboard() {
    return Promise.all([
      client.from('bookings').select('status'),
      client.from('favorites').select('event_id, events (id, title, starts_at, location)'),
      loadComingSoon()
    ]).then(function (r) {
      var bookings = r[0].data || [];
      page.querySelector('[data-stat="attended"]').textContent = bookings.filter(function (b) { return b.status === 'attended'; }).length;
      page.querySelector('[data-stat="booked"]').textContent = bookings.filter(function (b) { return b.status === 'booked'; }).length;

      // Soonest first; "Coming soon" events (no date yet) at the end
      var events = (r[1].data || []).map(function (f) { return f.events; }).filter(Boolean).map(function (ev) {
        return r[2][ev.id] ? Object.assign({}, ev, { starts_at: null, location: null }) : ev;
      });
      events.sort(function (a, b) {
        if (!a.starts_at || !b.starts_at) return a.starts_at ? -1 : b.starts_at ? 1 : a.title.localeCompare(b.title);
        return a.starts_at < b.starts_at ? -1 : 1;
      });
      var list = page.querySelector('[data-favorites]');
      list.replaceChildren.apply(list, events.map(favoriteItem));
      list.hidden = !events.length;
      page.querySelector('[data-favorites-empty]').hidden = !!events.length;
    });
  }

  function showDashboard(user) {
    var meta = user.user_metadata || {};
    page.querySelector('[data-first-name]').textContent = meta.first_name || 'there';
    show('dashboard');
    return loadDashboard();
  }

  // ---------- Profile ----------
  function fillProfile(user) {
    var meta = user.user_metadata || {};
    profileForm.elements.first_name.value = meta.first_name || '';
    profileForm.elements.phone.value = meta.phone || '';
    profileForm.elements.email.value = user.email || '';
    profileForm.elements.password.value = '';
    profileForm.elements.email_opt_in.checked = meta.email_opt_in === true;
    profileForm.elements.sms_opt_in.checked = meta.sms_opt_in === true;
    profileForm.elements.favorite_alerts.checked = meta.favorite_alerts !== false; // on unless they turned it off
  }

  page.addEventListener('click', function (e) {
    var b = e.target.closest('[data-show]');
    if (b) {
      var name = b.getAttribute('data-show');
      if (name === 'profile') {
        client.auth.getUser().then(function (r) { if (r.data.user) fillProfile(r.data.user); show('profile'); });
      } else {
        client.auth.getUser().then(function (r) { if (r.data.user) showDashboard(r.data.user); });
      }
      return;
    }
    var a = e.target.closest('[data-open-auth]');
    if (a) Orvella.openAuth({ view: a.getAttribute('data-open-auth'), then: start });
  });

  forms.onSubmit(profileForm, function (form) {
    if (forms.needsPhone(form)) return;
    var email = forms.value(form, 'email');
    return client.auth.getUser().then(function (r) {
      if (r.error) throw r.error;
      var meta = r.data.user.user_metadata || {};
      var choices = forms.optIns(form);
      var changes = { data: Object.assign({ first_name: forms.value(form, 'first_name'), phone: forms.value(form, 'phone'), favorite_alerts: form.elements.favorite_alerts.checked }, choices) };
      if (choices.email_opt_in !== (meta.email_opt_in === true) || choices.sms_opt_in !== (meta.sms_opt_in === true)) {
        changes.data.opt_in_at = new Date().toISOString();
      }
      var newEmail = email.toLowerCase() !== (r.data.user.email || '').toLowerCase();
      if (newEmail) changes.email = email;
      var newPassword = form.elements.password.value;
      if (newPassword) changes.password = newPassword;
      return client.auth.updateUser(changes, { emailRedirectTo: returnTo }).then(function (u) {
        if (u.error) throw u.error;
        fillProfile(u.data.user);
        if (newEmail) form.elements.email.value = email;
        forms.status(form, newEmail
          ? 'Saved. To change your email, click the link we sent to ' + email + ' (and to your old email too).'
          : newPassword ? 'Saved, including your new password.' : 'Saved.');
      });
    });
  });

  page.querySelector('[data-logout]').addEventListener('click', function () {
    client.auth.signOut().then(function () { show('loggedout'); });
  });

  forms.onSubmit(resetForm, function (form) {
    return client.auth.updateUser({ password: form.elements.password.value }).then(function (r) {
      if (r.error) throw r.error;
      Orvella.recovering = false;
      fillProfile(r.data.user);
      show('profile');
      forms.status(profileForm, 'Your new password is saved.');
    });
  });
  document.addEventListener('orvella:recovery', function () { show('reset'); });

  // ---------- Start ----------
  function start() {
    return Orvella.getSession().then(function (session) {
      if (session && Orvella.recovering) return show('reset');
      if (session) return showDashboard(session.user);
      show('loggedout');
      // An old or already-used link from one of our emails
      if (/error_description=/.test(location.hash)) {
        page.querySelector('[data-loggedout-status]').textContent = 'That link has expired or was already used. Log in, or reset your password to get a new link.';
        history.replaceState(null, '', returnTo + location.search);
      }
    });
  }

  Orvella.getClient()
    .then(function (c) { client = c; return start(); })
    .catch(function () { show('unavailable'); });
})();
