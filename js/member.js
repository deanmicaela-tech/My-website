// Member features on every page: the profile icon in the header, the log in /
// sign up pop-up, and the hearts on events. Accounts live in Supabase; the
// browser only ever gets the public URL and "anon" key, from /api/config
// (netlify/functions/config.mjs). account.js builds the account page on top of this.
(function () {
  var root = new URL('..', document.currentScript.src).href; // the site's home folder
  var accountUrl = root + 'account.html';
  var Orvella = window.Orvella = window.Orvella || {};
  Orvella.recovering = /type=recovery/.test(location.hash); // came from a password-reset email

  // ---------- Supabase ----------
  var clientPromise = null;
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  // Resolves to the Supabase client, or rejects if accounts aren't set up yet
  Orvella.getClient = function () {
    if (!clientPromise) {
      clientPromise = fetch('/api/config')
        .then(function (r) { return r.ok ? r.json() : {}; })
        .then(function (cfg) {
          if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) throw new Error('not set up');
          return loadScript(root + 'js/vendor/supabase-2.117.2.js').then(function () {
            var client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
              auth: { flowType: 'implicit', persistSession: true, detectSessionInUrl: true }
            });
            client.auth.onAuthStateChange(function (event) {
              if (event === 'PASSWORD_RECOVERY') {
                Orvella.recovering = true;
                document.dispatchEvent(new CustomEvent('orvella:recovery'));
              }
              if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') setIcon();
            });
            return client;
          });
        });
    }
    return clientPromise;
  };
  Orvella.getSession = function () {
    return Orvella.getClient().then(function (client) {
      return client.auth.getSession().then(function (r) { return r.data.session; });
    });
  };
  // Supabase keeps the login in this browser's storage as sb-...-auth-token
  Orvella.seemsLoggedIn = function () {
    try {
      return Object.keys(localStorage).some(function (k) { return /^sb-.+-auth-token$/.test(k); });
    } catch (e) { return false; }
  };

  // ---------- Form helpers (shared with account.js) ----------
  var forms = Orvella.forms = {
    status: function (form, text) { form.querySelector('.form-status').textContent = text; },
    value: function (form, name) { return form.elements[name].value.trim(); },
    friendly: function (error) {
      var m = (error && error.message) || '';
      if (/invalid login credentials/i.test(m)) return "That email and password don't match. Try again or reset your password.";
      if (/email not confirmed/i.test(m)) return 'Please confirm your email first. Check your inbox for the link we sent.';
      if (/already registered|already exists/i.test(m)) return 'There is already an account with that email. Try logging in.';
      if (/rate limit|too many|security purposes/i.test(m)) return 'Too many tries. Please wait a minute and try again.';
      if (/password/i.test(m) && /least|short|weak/i.test(m)) return 'Please choose a password with at least 8 characters.';
      if (/same.*password|different from the old/i.test(m)) return 'Please choose a password different from your old one.';
      return m || 'Something went wrong. Please try again.';
    },
    // Basic checks before anything is sent; returns an error message or ''
    check: function (form) {
      var bad = Array.prototype.filter.call(form.elements, function (el) { return el.willValidate && !el.checkValidity(); })[0];
      if (!bad) return '';
      bad.focus();
      if (bad.type === 'email') return 'Please enter a valid email address.';
      if (bad.type === 'password') return 'Please choose a password with at least 8 characters.';
      return 'Please fill in your ' + bad.labels[0].firstChild.textContent.trim().toLowerCase() + '.';
    },
    onSubmit: function (form, handler) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var problem = forms.check(form);
        if (problem) return forms.status(form, problem);
        forms.status(form, '');
        var buttons = form.querySelectorAll('button');
        buttons.forEach(function (b) { b.disabled = true; });
        Promise.resolve()
          .then(function () { return handler(form); })
          .catch(function (err) { forms.status(form, forms.friendly(err)); })
          .then(function () { buttons.forEach(function (b) { b.disabled = false; }); });
      });
    },
    // Email / text sign-up choices, saved with the account as proof of consent
    optIns: function (form) {
      return { email_opt_in: form.elements.email_opt_in.checked, sms_opt_in: form.elements.sms_opt_in.checked };
    },
    needsPhone: function (form) {
      if (!form.elements.sms_opt_in.checked || forms.value(form, 'phone')) return false;
      form.elements.phone.focus();
      forms.status(form, 'Please add your phone number so we can text you.');
      return true;
    },
    optInBoxes: function (prefix) {
      return '<div class="waiver">' +
        '<label class="waiver-check" for="' + prefix + '-email-opt"><input id="' + prefix + '-email-opt" name="email_opt_in" type="checkbox">' +
        '<span>Email me Orvella news, new events and offers.</span></label>' +
        '<label class="waiver-check" for="' + prefix + '-sms-opt"><input id="' + prefix + '-sms-opt" name="sms_opt_in" type="checkbox">' +
        '<span>Text me Orvella news and event updates. Msg &amp; data rates may apply. Reply STOP to opt out.</span></label>' +
        '</div>';
    }
  };

  // ---------- Header profile icon ----------
  var icons = document.querySelectorAll('[data-account-link]');
  function setIcon() {
    var inside = Orvella.seemsLoggedIn();
    icons.forEach(function (a) {
      a.setAttribute('aria-label', inside ? 'Your account' : 'Log in or sign up');
      a.title = inside ? 'Your account' : 'Log in or sign up';
      a.classList.toggle('is-member', inside);
    });
  }
  setIcon();
  icons.forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (Orvella.seemsLoggedIn()) return; // straight to the account page
      e.preventDefault();
      Orvella.openAuth();
    });
  });

  // ---------- Log in / sign up pop-up ----------
  var dialog = null;
  var afterLogin = null;

  function field(id, name, label, type, auto, extra) {
    return '<div class="field"><label for="' + id + '">' + label + '</label>' +
      '<input id="' + id + '" name="' + name + '" type="' + type + '" autocomplete="' + auto + '"' + (extra || '') + '></div>';
  }
  function actions(button) {
    return '<div class="form-actions"><button class="btn" type="submit">' + button + '</button>' +
      '<p class="form-status" role="status" aria-live="polite"></p></div>';
  }

  function buildDialog() {
    dialog = document.createElement('dialog');
    dialog.className = 'waiver-dialog auth-dialog';
    dialog.setAttribute('aria-labelledby', 'auth-title');
    dialog.innerHTML =
      '<div class="waiver-dialog-head"><h2 id="auth-title">Log in</h2>' +
      '<button class="waiver-close" type="button" data-close-auth aria-label="Close">&times;</button></div>' +
      '<div class="waiver-body auth-body">' +
        '<p class="account-note" data-auth-note hidden></p>' +
        '<p class="account-note" data-auth="unavailable" hidden>Member accounts are coming soon.</p>' +
        '<form class="contact-form" data-auth="login" novalidate>' +
          field('au-li-email', 'email', 'Email', 'email', 'email', ' required') +
          field('au-li-password', 'password', 'Password', 'password', 'current-password', ' required') +
          actions('Log in') +
          '<p class="account-links"><button class="link-button" type="button" data-auth-show="forgot">Forgot your password?</button>' +
          '<span>New here? <button class="link-button" type="button" data-auth-show="signup">Create an account</button></span></p>' +
        '</form>' +
        '<form class="contact-form" data-auth="signup" novalidate hidden>' +
          '<div class="field-row">' +
            field('au-su-name', 'first_name', 'First name', 'text', 'given-name', ' required') +
            field('au-su-phone', 'phone', 'Phone <span class="optional">(optional)</span>', 'tel', 'tel') +
          '</div>' +
          field('au-su-email', 'email', 'Email', 'email', 'email', ' required') +
          field('au-su-password', 'password', 'Password <span class="optional">(at least 8 characters)</span>', 'password', 'new-password', ' minlength="8" required') +
          forms.optInBoxes('au-su') +
          actions('Create account') +
          '<p class="account-links"><span>Already have an account? <button class="link-button" type="button" data-auth-show="login">Log in</button></span></p>' +
        '</form>' +
        '<form class="contact-form" data-auth="forgot" novalidate hidden>' +
          '<p class="account-note">Enter your email and we\'ll send you a link to choose a new password.</p>' +
          field('au-fp-email', 'email', 'Email', 'email', 'email', ' required') +
          actions('Send reset link') +
          '<p class="account-links"><button class="link-button" type="button" data-auth-show="login">Back to log in</button></p>' +
        '</form>' +
        '<div class="form-thanks" data-auth="sent" hidden tabindex="-1">' +
          '<h3>Check your email</h3><p data-auth-sent></p>' +
          '<button class="link-button" type="button" data-auth-show="login">Back to log in</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(dialog);

    var titles = { login: 'Log in', signup: 'Create an account', forgot: 'Reset your password', sent: 'Check your email', unavailable: 'Accounts' };
    dialog.view = function (name, userAction) {
      dialog.querySelectorAll('[data-auth]').forEach(function (v) { v.hidden = v.getAttribute('data-auth') !== name; });
      dialog.querySelectorAll('.form-status').forEach(function (s) { s.textContent = ''; });
      dialog.querySelector('#auth-title').textContent = titles[name];
      var first = dialog.querySelector('[data-auth="' + name + '"] input');
      if (first && userAction) first.focus();
    };
    function sent(message) {
      dialog.querySelector('[data-auth-sent]').textContent = message;
      dialog.view('sent');
    }
    function loggedIn() {
      setIcon();
      var next = afterLogin;
      afterLogin = null;
      dialog.close();
      if (next) next();
      else location.href = accountUrl;
    }

    dialog.addEventListener('click', function (e) {
      if (e.target === dialog || e.target.closest('[data-close-auth]')) return dialog.close();
      var b = e.target.closest('[data-auth-show]');
      if (b) dialog.view(b.getAttribute('data-auth-show'), true);
    });
    dialog.addEventListener('close', function () { afterLogin = null; });

    forms.onSubmit(dialog.querySelector('[data-auth="login"]'), function (form) {
      return Orvella.getClient().then(function (client) {
        return client.auth.signInWithPassword({ email: forms.value(form, 'email'), password: form.elements.password.value });
      }).then(function (r) { if (r.error) throw r.error; loggedIn(); });
    });

    forms.onSubmit(dialog.querySelector('[data-auth="signup"]'), function (form) {
      if (forms.needsPhone(form)) return;
      var email = forms.value(form, 'email');
      var data = Object.assign({ first_name: forms.value(form, 'first_name'), phone: forms.value(form, 'phone') }, forms.optIns(form));
      if (data.email_opt_in || data.sms_opt_in) data.opt_in_at = new Date().toISOString();
      return Orvella.getClient().then(function (client) {
        return client.auth.signUp({ email: email, password: form.elements.password.value, options: { emailRedirectTo: accountUrl, data: data } });
      }).then(function (r) {
        if (r.error) throw r.error;
        if (r.data.session) return loggedIn();
        sent('We sent a link to ' + email + '. Click it to confirm your email, and you will be logged in.');
      });
    });

    forms.onSubmit(dialog.querySelector('[data-auth="forgot"]'), function (form) {
      var email = forms.value(form, 'email');
      return Orvella.getClient().then(function (client) {
        return client.auth.resetPasswordForEmail(email, { redirectTo: accountUrl });
      }).then(function (r) {
        if (r.error) throw r.error;
        sent('If there is an account for ' + email + ', we sent it a link to choose a new password.');
      });
    });
  }

  // Opens the pop-up. options: view ('login' or 'signup'), note (a line shown at
  // the top), then (runs after logging in, instead of going to the account page).
  Orvella.openAuth = function (options) {
    options = options || {};
    if (!dialog) buildDialog();
    var note = dialog.querySelector('[data-auth-note]');
    note.textContent = options.note || '';
    note.hidden = !options.note;
    dialog.view('login');
    if (!dialog.open) dialog.showModal();
    afterLogin = options.then || null;
    Orvella.getClient().then(function () {
      if (options.view) dialog.view(options.view);
    }, function () { dialog.view('unavailable'); });
  };

  // ---------- Hearts ----------
  var hearts = document.querySelectorAll('[data-favorite]');
  function mark(id, on) {
    document.querySelectorAll('[data-favorite="' + id + '"]').forEach(function (h) { h.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  }
  Orvella.markFavorites = function () {
    return Orvella.getSession().then(function (session) {
      if (!session) return;
      return Orvella.getClient().then(function (client) {
        return client.from('favorites').select('event_id');
      }).then(function (r) {
        if (r.error) return;
        r.data.forEach(function (row) { mark(row.event_id, true); });
      });
    }).catch(function () {});
  };
  Orvella.setFavorite = function (id, on) {
    mark(id, on);
    return Orvella.getClient().then(function (client) {
      return on
        ? client.from('favorites').insert({ event_id: id })
        : client.from('favorites').delete().eq('event_id', id);
    }).then(function (r) {
      if (r.error && r.error.code !== '23505') throw r.error; // 23505: already saved
    }).catch(function () { mark(id, !on); });
  };
  if (hearts.length) {
    if (Orvella.seemsLoggedIn()) Orvella.markFavorites();
    document.addEventListener('click', function (e) {
      var h = e.target.closest('[data-favorite]');
      if (!h) return;
      var id = h.getAttribute('data-favorite');
      var on = h.getAttribute('aria-pressed') !== 'true';
      Orvella.getSession().catch(function () { return null; }).then(function (session) {
        if (session) return Orvella.setFavorite(id, on);
        Orvella.openAuth({
          note: 'Log in or create an account to save your favorite pop-ups.',
          then: function () { Orvella.setFavorite(id, true).then(Orvella.markFavorites); }
        });
      });
    });
  }
})();
