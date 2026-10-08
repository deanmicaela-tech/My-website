# Orvella

Draft website for **Orvella**, a pilates and wellness community hosting pop-up classes and private events (bridal parties, birthdays, grand openings and more).

It is a plain static site (HTML, CSS and a little JavaScript), so it can be hosted almost anywhere and connected to your GoDaddy domain later.

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

**Q&A (`faq.html`)**: common questions about pop-up classes and private events, in two groups. To add a question, copy one `<details class="faq-item">` block and change the text.

The header and footer appear in both files, so if you change a link or the social icons, change it in both.

## Files

```
index.html              the home page (all its text lives here)
faq.html                the Q&A page
css/styles.css          colours, fonts and layout
js/main.js              mobile menu and contact form
assets/favicon.svg      browser tab icon
assets/orvella-wordmark.svg  your logo as a crisp vector (traced from the logo image)
assets/orvella-logo.jpg      the original logo image
```

To preview, open `index.html` in a browser.

## Things to fill in before going live

Search `index.html` for these comments:

- **`SOCIAL LINKS`**: Instagram already points to @orvellawellness. Replace the `href="#"` on the TikTok, Facebook and Pinterest icons with your profile links, or delete the ones you don't use (in both `index.html` and `faq.html`).
- **`BOOKING LINK`**: replace `href="#events"` on the "Book a pop-up" button with your booking page (Momence, Acuity, Eventbrite, Luma, etc.). You can point each event's **Reserve** button at its own ticket link too.
- **`FORM`**: the form shows a thank-you message but does not send anything until you connect it. The easiest way:
  1. Create a free form at [formspree.io](https://formspree.io).
  2. Copy the form endpoint it gives you (looks like `https://formspree.io/f/abcdwxyz`).
  3. Paste it into `data-endpoint=""` on the `<form id="contact-form">` tag.
- **Events**: the four pop-ups are sample events. Copy or delete the `<li class="event">` blocks to match your real dates.
- **Copy**: all wording, including the Q&A answers, is a starting point. Change anything that doesn't sound like you or isn't accurate.

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
