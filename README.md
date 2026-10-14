# Orvella

Draft website for **Orvella**, a pilates and wellness community hosting pop-up classes and private events (bridal parties, birthdays, grand openings and more).

It is a plain static site (HTML, CSS and a little JavaScript), hosted on Netlify at [orvellawellness.com](https://orvellawellness.com). Netlify republishes the site whenever the `main` branch changes.

## Pages

**Home (`index.html`)**

| Section | What it's for |
| --- | --- |
| Hero | Your logo, a one-line intro, and buttons to pop-ups and private events |
| Who we are | Short description of Orvella and what you offer |
| Upcoming pop-ups | List of public pop-up classes with a Reserve button on each |
| Where to book | One card for public pop-ups, one for private event inquiries |
| Contact | Contact details and an inquiry form |
| Footer | Navigation and social media icons |

**Q&A (`faq.html`)**: common questions about pop-up classes and private events, in two groups, each with a small icon. To add a question, copy one `<div class="faq-item">` block and change the text.

**Event pages (`events/*.html`)**: one page per pop-up, opened by its Reserve button. Each shows a photo (a branded placeholder until you add one), the price, date, time, location, length and level, and a booking form just for that class.

To add a photo, put it in `assets/events/` and follow the `PHOTO` comment in that event's page.

The header and footer appear in every page, so if you change a link or the social icons, change it in each.

## Files

```
index.html              the home page (all its text lives here)
faq.html                the Q&A page
events/                 one page per pop-up (details, price, photo, booking form)
netlify.toml            tells Netlify to serve the site as-is (no build step)
css/styles.css          colours, fonts and layout
js/main.js              mobile menu, form sending and the mat map
account.html            a member's classes attended and booked, favorites, and profile
js/member.js            header profile icon, log in / sign up pop-up and event hearts (every page)
js/account.js           the account page
js/vendor/              Supabase's own browser library (copied in, don't edit)
netlify/                the mat map's saved bookings, and /api/config for accounts (Netlify Functions)
assets/favicon.svg      browser tab icon
assets/orvella-wordmark.svg  your logo as a crisp vector (traced from the logo image)
assets/orvella-logo.jpg      the original logo image
```

To preview, open `index.html` in a browser.

## Things to fill in before going live

Search `index.html` for these comments:

- **`SOCIAL LINKS`**: the footer links to Instagram and TikTok (@orvellawellness on both).
- **`BOOKING LINK`**: when you choose booking software (Luma, Momence, Eventbrite...), replace `reserve.html` on the "Book a pop-up" button with your booking page. You can point each event's **Reserve** button at its own ticket link too.
- **Forms**: the contact form and the booking forms on the event pages are sent to **Netlify Forms** (as "contact" and "reserve"). Submissions show up in the Netlify dashboard under *Forms*. To get them by email, go to *Project configuration → Notifications → Emails and webhooks → Form submission notifications* and add your email.
- **Events**: the six pop-ups (Nov 2026 to Feb 2027). Descriptions are a starting point, and locations say "announced soon" until they are set. To add an event, copy an `<li class="event">` block in `index.html`, copy one of the pages in `events/` and update both, and point the new Reserve button at the new page. To remove one, delete its block and its page.
- **Booking windows**: each event's booking form opens one week before the class starts. Until then the booking box on the event page says when booking opens. The switch happens on its own at that moment, no redeploy needed. The opening time is the `data-booking-opens` value on the booking box in the event page, read as local time in the `TIME_ZONE` set in `js/main.js` (currently US Eastern). If you change an event's date or time, update that value and the "Booking opens" text next to them.
- **Mat map (Sunrise Beach Pilates)**: guests pick their own mats on a map of 3 rows of 15 (A1 to C15, row A at the front nearest the instructor, row C at the back), one per booking (each booking is for one person; set by `data-max` on the map and `maxPerBooking` in `mats-core.mjs`). Their mats are listed in the "mats" field of the booking email. Taken mats are saved in Netlify under *Blobs → mat-bookings*, one entry per mat (for example `sunrise-beach-pilates/B7`, which also shows who booked it). If someone cancels, delete their mat entries there and the mats show as open again. The mat code is `netlify/functions/mats.mjs` and `netlify/lib/mats-core.mjs` (the layout and booking opening time for the server are set at the top of `mats-core.mjs`).
- **Waiver (Sunrise Beach Pilates)**: guests must tick "I have read and agree to the waiver and policies" before booking. The full waiver opens in a pop-up from the checkbox; its wording is in the event page (search for `WAIVER`). Each booking email shows `waiver: Agreed`, and the saved mat entry records `waiverAgreed`.
- **Copy**: all wording, including the Q&A answers, is a starting point. Change anything that doesn't sound like you or isn't accurate.

## Member accounts

Members tap the profile icon in every page's header to log in or sign up in a pop-up; once logged in, the icon goes to `account.html`, which shows how many classes they've attended and booked, their favorite pop-ups, and an *Edit profile* section. The hearts on the home page's events save favorites (logged out, a tap opens the log in pop-up). Accounts are run by [Supabase](https://supabase.com); the site keeps no passwords itself.

The account page only works once these are set in Netlify under *Project configuration → Environment variables* (then redeploy):

| Name | Where to find it |
| --- | --- |
| `SUPABASE_URL` | Supabase → Project Settings → API (Project URL) |
| `SUPABASE_ANON_KEY` | Supabase → Project Settings → API keys (the *anon* / *publishable* key) |

Both are public by design. Never put the *service_role* / *secret* key in the site's code. Until they are set, the account page says member accounts are coming soon.

In Supabase, under *Authentication → URL Configuration*, set the Site URL to `https://orvellawellness.com` and add `https://orvellawellness.com/account.html` to the Redirect URLs, so the confirmation and password-reset emails link back to the site.

### Member database

`supabase/setup.sql` creates the member tables in Supabase: **events** (the pop-ups), **bookings** (who booked what, and whether they attended or cancelled), **favorites** (hearted events) and **profiles**. To set it up or refresh it, open Supabase → *SQL Editor* → *New query*, paste the whole file and click *Run*. Running it again is safe.

Members can only ever see their own bookings and favorites; bookings can only be added or changed by the site's own server code, never from a browser. A booking is matched to a member by email, once they have confirmed that email, including bookings made before they signed up. When you add a new event, add a row for it in the **events** table (its id is the event page's file name without `.html`).

### Favorite alerts

When booking opens for a pop-up, everyone who hearted it gets one email from Orvella with a "Book your spot" button (`netlify/functions/favorite-alerts.mjs`, checked every 15 minutes, for the first 3 days after booking opens). Members can turn these off with the "Email me when my favorites open for booking" box in *Edit profile*. The opening times are listed at the top of `netlify/lib/favorite-alerts-core.mjs`; when a "Coming soon" pop-up gets its date, add it there too.

It only runs once these are set in Netlify under *Project configuration → Environment variables* (tick **Contains secret values** for the two secret ones):

| Name | What to put |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` (secret) | Supabase → Project Settings → API keys (the *service_role* / *secret* key) |
| `SMTP_USER` | `orvellawellness@gmail.com` |
| `SMTP_PASS` (secret) | A Gmail app password (myaccount.google.com/apppasswords) |

The service role key can read every member's data, so it must only ever live in this secret variable, never in the site's code.

## Brand

| Token | Colour | Used for |
| --- | --- | --- |
| Off-white | `#FBF7F2` | Page background |
| Cream | `#F3E5CA` | Centre of the logo glow, footer |
| Rose | `#C69E9C` | Your wordmark colour, ornaments |
| Mauve | `#AC777F` | Edge of the logo gradient |
| Berry | `#8C5B65` | Buttons and links (a deeper mauve so text stays readable) |
| Plum ink | `#5C3A43` | Headings and body text |

Fonts: the logo is your TAN Kindred wordmark, embedded as an SVG drawing so it looks identical everywhere without needing the font. TAN Kindred is a paid font that isn't on Google Fonts, so headings use **Fraunces** (a soft, 70s-style serif that pairs with it), body text uses **Jost**, and the little script accents use **Pinyon Script**.

## Connecting your GoDaddy domain

GoDaddy only needs to point your domain at wherever the site is hosted. Two simple free options:

**Netlify (easiest)**
1. Sign up at [netlify.com](https://www.netlify.com), choose "Deploy manually" and drag this folder in (or connect this GitHub repo).
2. In Netlify go to *Domain management → Add a domain* and enter your domain.
3. Netlify shows the DNS records to add. In GoDaddy open *My Products → your domain → DNS* and add them.

**GitHub Pages**
1. In this repo go to *Settings → Pages*, choose "Deploy from a branch", pick `main` and `/ (root)`. (Pages on a private repo needs a paid GitHub plan.)
2. Enter your domain under *Custom domain*.
3. In GoDaddy DNS add four `A` records for `@` pointing to `185.199.108.153`, `185.199.109.153`, `185.199.110.153` and `185.199.111.153`, and a `CNAME` record for `www` pointing to `deanmicaela-tech.github.io`.

DNS changes can take up to a few hours to show up.
