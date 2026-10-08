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

  // Contact form
  var form = document.getElementById('contact-form');
  var status = document.getElementById('form-status');
  if (!form) return;

  function showThanks(name, previewOnly) {
    var card = form.parentElement;
    var first = (name || '').trim().split(/\s+/)[0];
    card.innerHTML =
      '<div class="form-thanks" tabindex="-1">' +
        '<svg class="bow" aria-hidden="true" focusable="false"><use href="#bow"/></svg>' +
        '<h3></h3>' +
        '<p>We have your note and will be in touch soon to start planning.</p>' +
        (previewOnly
          ? '<p class="preview-note">Preview mode: this form is not connected to an inbox yet, so nothing was sent.</p>'
          : '') +
      '</div>';
    card.querySelector('h3').textContent = first ? 'Thank you, ' + first + '!' : 'Thank you!';
    card.querySelector('.form-thanks').focus();
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var endpoint = form.getAttribute('data-endpoint');
    var name = form.elements.name.value;

    if (!endpoint) {
      showThanks(name, true);
      return;
    }

    var button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    status.textContent = 'Sending...';

    fetch(endpoint, {
      method: 'POST',
      body: new FormData(form),
      headers: { Accept: 'application/json' }
    })
      .then(function (res) {
        if (!res.ok) throw new Error('Request failed');
        showThanks(name, false);
      })
      .catch(function () {
        button.disabled = false;
        status.textContent = 'Your message could not be sent. Please try again, or email us directly.';
      });
  });
})();
