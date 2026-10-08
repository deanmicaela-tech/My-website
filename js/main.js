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

  // Pre-select the class picked with a Reserve button (reserve.html?event=2026-10-24)
  var picked = new URLSearchParams(window.location.search).get('event');
  if (picked) {
    document.querySelectorAll('input[name="event"]').forEach(function (radio) {
      if (radio.getAttribute('data-id') === picked) radio.checked = true;
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

      fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(new FormData(form)).toString()
      })
        .then(function (res) {
          if (!res.ok) throw new Error('Request failed');
          showThanks(form);
        })
        .catch(function () {
          button.disabled = false;
          status.textContent = 'This could not be sent. Please try again, or email us at info@orvellawellness.com.';
        });
    });
  });
})();
