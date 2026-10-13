// Member accounts on account.html: log in, sign up, password reset, profile and log out.
// Accounts live in Supabase. The browser only ever gets the public URL and
// "anon" key, from /api/config (netlify/functions/config.mjs).
(function () {
  var card = document.querySelector('.account-card');
  if (!card) return;

  var views = card.querySelectorAll('[data-view]');
  var intro = document.querySelector('.contact-intro');
  var client = null;
  var recovering = /type=recovery/.test(location.hash);

  function show(name, userAction) {
    views.forEach(function (v) { v.hidden = v.getAttribute('data-view') !== name; });
    card.querySelectorAll('.form-status').forEach(function (s) { s.textContent = ''; });
    var loggedIn = name === 'profile';
    intro.querySelector('h2').innerHTML = loggedIn ? 'Your <em class="script">details</em>' : 'Welcome <em class="script">back</em>';
    intro.querySelector('p').textContent = loggedIn
      ? 'Keep your name, email and phone up to date so we can reach you about your pop-ups.'
      : "Log in to see your upcoming pop-ups, the classes you've been to and the events you've saved.";
    document.querySelectorAll('[data-account-link]').forEach(function (a) { a.textContent = loggedIn ? 'Account' : 'Log in'; });
    // Only when someone switches screens (focusing on page load would pop up a phone keyboard)
    var first = card.querySelector('[data-view="' + name + '"] input');
    if (first && userAction) first.focus();
  }

  function status(form, text) {
    form.querySelector('.form-status').textContent = text;
  }

  function friendly(error) {
    var m = (error && error.message) || '';
    if (/invalid login credentials/i.test(m)) return "That email and password don't match. Try again or reset your password.";
    if (/email not confirmed/i.test(m)) return 'Please confirm your email first. Check your inbox for the link we sent.';
    if (/already registered|already exists/i.test(m)) return 'There is already an account with that email. Try logging in.';
    if (/rate limit|too many|security purposes/i.test(m)) return 'Too many tries. Please wait a minute and try again.';
    if (/password/i.test(m) && /least|short|weak/i.test(m)) return 'Please choose a password with at least 8 characters.';
    if (/same.*password|different from the old/i.test(m)) return 'Please choose a password different from your old one.';
    return m || 'Something went wrong. Please try again.';
  }

  function sent(message) {
    card.querySelector('[data-sent-message]').textContent = message;
    show('sent');
    card.querySelector('[data-view="sent"]').focus();
  }

  function fillProfile(user) {
    var form = card.querySelector('[data-view="profile"]');
    var meta = user.user_metadata || {};
    form.elements.first_name.value = meta.first_name || '';
    form.elements.phone.value = meta.phone || '';
    form.elements.email.value = user.email || '';
    form.querySelector('[data-greeting]').textContent = meta.first_name ? 'Hi, ' + meta.first_name : 'Your details';
    show('profile');
  }

  function busy(form, on) {
    form.querySelectorAll('button').forEach(function (b) { b.disabled = on; });
  }

  // Basic checks before anything is sent; returns an error message or ''
  function check(form) {
    var bad = Array.prototype.filter.call(form.elements, function (el) { return el.willValidate && !el.checkValidity(); })[0];
    if (!bad) return '';
    bad.focus();
    if (bad.type === 'email') return 'Please enter a valid email address.';
    if (bad.type === 'password') return 'Please choose a password with at least 8 characters.';
    return 'Please fill in your ' + bad.labels[0].firstChild.textContent.trim().toLowerCase() + '.';
  }

  function onSubmit(name, handler) {
    var form = card.querySelector('[data-view="' + name + '"]');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var problem = check(form);
      if (problem) return status(form, problem);
      status(form, '');
      busy(form, true);
      Promise.resolve(handler(form))
        .catch(function (err) { status(form, friendly(err)); })
        .then(function () { busy(form, false); });
    });
  }

  function value(form, name) { return form.elements[name].value.trim(); }
  var returnTo = location.origin + location.pathname;

  card.addEventListener('click', function (e) {
    var b = e.target.closest('[data-show]');
    if (b) show(b.getAttribute('data-show'), true);
  });

  onSubmit('login', function (form) {
    return client.auth.signInWithPassword({ email: value(form, 'email'), password: form.elements.password.value })
      .then(function (r) { if (r.error) throw r.error; fillProfile(r.data.user); });
  });

  onSubmit('signup', function (form) {
    var email = value(form, 'email');
    return client.auth.signUp({
      email: email,
      password: form.elements.password.value,
      options: {
        emailRedirectTo: returnTo,
        data: { first_name: value(form, 'first_name'), phone: value(form, 'phone') }
      }
    }).then(function (r) {
      if (r.error) throw r.error;
      if (r.data.session) return fillProfile(r.data.user);
      sent('We sent a link to ' + email + '. Click it to confirm your email, and you will be logged in.');
    });
  });

  onSubmit('forgot', function (form) {
    var email = value(form, 'email');
    return client.auth.resetPasswordForEmail(email, { redirectTo: returnTo })
      .then(function (r) {
        if (r.error) throw r.error;
        sent('If there is an account for ' + email + ', we sent it a link to choose a new password.');
      });
  });

  onSubmit('reset', function (form) {
    return client.auth.updateUser({ password: form.elements.password.value })
      .then(function (r) {
        if (r.error) throw r.error;
        recovering = false;
        fillProfile(r.data.user);
        status(card.querySelector('[data-view="profile"]'), 'Your new password is saved.');
      });
  });

  onSubmit('profile', function (form) {
    var email = value(form, 'email');
    return client.auth.getUser().then(function (r) {
      if (r.error) throw r.error;
      var changes = { data: { first_name: value(form, 'first_name'), phone: value(form, 'phone') } };
      var newEmail = email.toLowerCase() !== (r.data.user.email || '').toLowerCase();
      if (newEmail) changes.email = email;
      return client.auth.updateUser(changes, { emailRedirectTo: returnTo }).then(function (u) {
        if (u.error) throw u.error;
        fillProfile(u.data.user);
        if (newEmail) form.elements.email.value = email;
        status(form, newEmail
          ? 'Saved. To change your email, click the link we sent to ' + email + ' (and to your old email too).'
          : 'Saved.');
      });
    });
  });

  card.querySelector('[data-logout]').addEventListener('click', function () {
    client.auth.signOut().then(function () { show('login'); });
  });

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  fetch('/api/config')
    .then(function (r) { return r.ok ? r.json() : {}; })
    .then(function (cfg) {
      if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) throw new Error('not set up');
      return loadScript('js/vendor/supabase-2.117.2.js').then(function () {
        client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
          auth: { flowType: 'implicit', persistSession: true, detectSessionInUrl: true }
        });
        client.auth.onAuthStateChange(function (event) {
          if (event === 'PASSWORD_RECOVERY') { recovering = true; show('reset'); }
        });
        return client.auth.getSession();
      });
    })
    .then(function (r) {
      var session = r.data && r.data.session;
      var params = new URLSearchParams(location.search);
      if (session && recovering) show('reset');
      else if (session) fillProfile(session.user);
      else show(params.get('view') === 'signup' ? 'signup' : 'login');
      // An old or already-used link from one of our emails
      if (!session && /error_description=/.test(location.hash)) {
        status(card.querySelector('[data-view="login"]'), 'That link has expired or was already used. Log in, or reset your password to get a new link.');
        history.replaceState(null, '', returnTo + location.search);
      }
    })
    .catch(function () { show('unavailable'); });
})();
