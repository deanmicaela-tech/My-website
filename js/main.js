(function () {
  var header = document.getElementById('site-header');
  var toggle = document.getElementById('menu-toggle');
  var nav = document.getElementById('site-nav');

  // Mobile menu
  function setMenu(open) {
    header.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  toggle.addEventListener('click', function () {
    setMenu(!header.classList.contains('is-open'));
  });
  nav.addEventListener('click', function (e) {
    if (e.target.closest('a')) setMenu(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setMenu(false);
  });

  // Hairline under the header once the page scrolls
  function onScroll() {
    header.classList.toggle('is-scrolled', window.scrollY > 8);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Footer year
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  // Earliest selectable event date is today
  var date = document.getElementById('cf-date');
  if (date) {
    var t = new Date();
    date.min = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
  }

  // Booking opens one week before each class (data-booking-opens on the event,
  // written as local time in TIME_ZONE). Before then, anything marked
  // data-when="before" shows; after, data-when="after" shows instead.
  var TIME_ZONE = 'America/New_York';
  var zoneParts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE, hourCycle: 'h23',
    year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric'
  });
  function zoneOffset(t) {
    var p = {};
    zoneParts.formatToParts(new Date(t)).forEach(function (x) { p[x.type] = x.value; });
    return Date.UTC(+p.year, p.month - 1, +p.day, +p.hour, +p.minute) - t;
  }
  function zonedTime(local) {
    var n = local.split(/[-T:]/).map(Number);
    var asUtc = Date.UTC(n[0], n[1] - 1, n[2], n[3], n[4]);
    return asUtc - zoneOffset(asUtc - zoneOffset(asUtc));
  }
  var gated = document.querySelectorAll('[data-booking-opens]');
  function updateBooking() {
    var now = Date.now();
    var waiting = false;
    gated.forEach(function (el) {
      var open = now >= zonedTime(el.getAttribute('data-booking-opens'));
      if (!open) waiting = true;
      el.querySelectorAll('[data-when]').forEach(function (part) {
        part.hidden = part.getAttribute('data-when') !== (open ? 'after' : 'before');
      });
    });
    if (!waiting) clearInterval(bookingTimer);
  }
  var bookingTimer = gated.length ? setInterval(updateBooking, 30000) : null;
  if (gated.length) updateBooking();

  // Mat map: visitors pick their own mats. Taken mats come from /api/mats,
  // which also makes sure two people can't book the same mat.
  var matMaps = [];
  document.querySelectorAll('[data-mat-map]').forEach(function (box) {
    var slug = box.getAttribute('data-mat-map');
    var rows = box.getAttribute('data-rows').split(',');
    var perRow = +box.getAttribute('data-per-row');
    var max = +box.getAttribute('data-max');
    var grid = box.querySelector('.mat-grid');
    var label = box.querySelector('.mat-picked');
    var form = box.closest('form');
    var picked = [];
    var taken = {};
    var buttons = {};

    grid.style.setProperty('--per-row', perRow);
    rows.forEach(function (row) {
      var tag = document.createElement('span');
      tag.className = 'mat-row-label';
      tag.textContent = row;
      tag.setAttribute('aria-hidden', 'true');
      grid.appendChild(tag);
      for (var i = 1; i <= perRow; i++) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'mat';
        b.value = row + i;
        b.textContent = i;
        b.setAttribute('aria-pressed', 'false');
        b.setAttribute('aria-label', 'Row ' + row + ', mat ' + i);
        buttons[row + i] = b;
        grid.appendChild(b);
      }
    });

    function render() {
      Object.keys(buttons).forEach(function (mat) {
        var b = buttons[mat];
        var mine = picked.indexOf(mat) !== -1;
        b.classList.toggle('is-taken', !!taken[mat]);
        b.classList.toggle('is-picked', mine);
        b.disabled = !!taken[mat];
        b.setAttribute('aria-pressed', mine ? 'true' : 'false');
      });
      form.elements.mats.value = picked.join(', ');
      form.elements.spots.value = picked.length || '';
      label.textContent = picked.length
        ? 'Your mat' + (picked.length > 1 ? 's' : '') + ': ' + picked.join(', ')
        : 'No mat chosen yet.';
    }

    grid.addEventListener('click', function (e) {
      var b = e.target.closest('.mat');
      if (!b || b.disabled) return;
      var at = picked.indexOf(b.value);
      if (at !== -1) picked.splice(at, 1);
      else if (picked.length < max) picked.push(b.value);
      else { label.textContent = 'You can pick up to ' + max + ' mats per booking.'; return; }
      render();
    });

    function refresh() {
      return fetch('/api/mats?event=' + encodeURIComponent(slug), { cache: 'no-store' })
        .then(function (res) { return res.ok ? res.json() : null; })
        .then(function (data) { if (data) setTaken(data.taken); })
        .catch(function () {});
    }
    function setTaken(list) {
      taken = {};
      list.forEach(function (mat) { taken[mat] = true; });
      var lost = picked.filter(function (mat) { return taken[mat]; });
      picked = picked.filter(function (mat) { return !taken[mat]; });
      render();
      return lost;
    }

    matMaps.push({ form: form, slug: slug, picked: function () { return picked.slice(); }, setTaken: setTaken });
    render();
    refresh();
    setInterval(function () { if (!form.hidden && document.visibilityState === 'visible') refresh(); }, 20000);
  });

  // Reserve the chosen mats before the booking request goes to Netlify Forms
  function matError(message) {
    var err = new Error(message);
    err.show = true;
    return err;
  }
  function claimMats(form) {
    var map = matMaps.filter(function (m) { return m.form === form; })[0];
    if (!map) return Promise.resolve();
    var mats = map.picked();
    if (!mats.length) return Promise.reject(matError('Please choose your mat on the map above.'));
    if (form.dataset.claimed === mats.join(',')) return Promise.resolve();
    return fetch('/api/mats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: map.slug, mats: mats,
        name: form.elements.name.value, email: form.elements.email.value,
        phone: form.elements.phone.value, 'bot-field': form.elements['bot-field'].value
      })
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (res.status === 409) {
          var lost = map.setTaken(data.taken || []);
          throw matError('Sorry, someone just booked ' + (lost.join(', ') || 'that mat') + '. Please pick another mat.');
        }
        if (!res.ok) throw new Error('Request failed');
        form.dataset.claimed = mats.join(',');
      });
    });
  }

  // Forms are sent to Netlify Forms, which collects the submissions
  function showThanks(form) {
    var card = form.parentElement;
    var first = (form.elements.name.value || '').trim().split(/\s+/)[0];
    var picked = form.elements.event ? form.elements.event.value : '';
    var message = (form.getAttribute('data-thanks') || '').replace('{event}', picked);
    card.innerHTML =
      '<div class="form-thanks" tabindex="-1">' +
        '<svg class="bow" aria-hidden="true" focusable="false"><use href="#bow"/></svg>' +
        '<h3></h3><p></p>' +
      '</div>';
    card.querySelector('h3').textContent = first ? 'Thank you, ' + first + '!' : 'Thank you!';
    card.querySelector('p').textContent = message;
    card.querySelector('.form-thanks').focus();
  }

  document.querySelectorAll('form[data-netlify]').forEach(function (form) {
    var status = form.querySelector('.form-status');
    var button = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      button.disabled = true;
      status.textContent = 'Sending...';

      claimMats(form)
        .then(function () {
          return fetch('/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(new FormData(form)).toString()
          });
        })
        .then(function (res) {
          if (!res.ok) throw new Error('Request failed');
          showThanks(form);
        })
        .catch(function (err) {
          button.disabled = false;
          status.textContent = err.show
            ? err.message
            : 'This could not be sent. Please try again, or email us at orvellawellness@gmail.com.';
        });
    });
  });
})();
