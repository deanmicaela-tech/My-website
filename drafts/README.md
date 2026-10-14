# Saved events (not on the site)

New Year's Pilates & Vision Boards (Dec 31, 2026) and Galentine's Pilates (Feb 6, 2027) were taken off the site for now, to bring back closer to the date.

The full event pages, with time, price, length and booking box, are in `drafts/events/`. Visitors who open anything in `drafts/` are sent to the pop-ups list (see `_redirects`).

To bring one back:
1. Move its page from `drafts/events/` to `events/`.
2. Paste its row below into the `<ol class="event-list">` in `index.html`, in date order.
3. Remove its redirect from `_redirects`.

```html
          <li class="event">
            <time class="event-date" datetime="2026-12-31"><span class="event-month">Dec</span><span class="event-day">31</span><span class="event-weekday">Thu</span></time>
            <div class="event-info">
              <h3>New Year’s Pilates &amp; Vision Boards</h3>
              <p class="event-meta">9:00 – 11:30 AM · Location announced soon</p>
              <p class="event-desc">end the year full of intention. flow through a pilates class then create a vision board for the year ahead with your girls and the orvella community.</p>
            </div>
            <a class="btn btn-small btn-outline" href="events/new-years-pilates-and-vision-boards.html">Reserve</a>
          </li>
          <li class="event">
            <time class="event-date" datetime="2027-02-06"><span class="event-month">Feb</span><span class="event-day">6</span><span class="event-weekday">Sat</span></time>
            <div class="event-info">
              <h3>Galentine’s Pilates</h3>
              <p class="event-meta">10:00 AM – 12:00 PM · Location announced soon</p>
              <p class="event-desc">a soft sweet morning with your girls. flow through a pilates class together then stay for little treats, pretty photos and time to celebrate each other.</p>
            </div>
            <a class="btn btn-small btn-outline" href="events/galentines-pilates.html">Reserve</a>
          </li>
```

## Sunrise Beach Pilates booking (saved 2026-10-14)

Sunrise Beach Pilates shows as "Coming soon" until a new date is picked. Its full booking page, with the $37 price, 45 spots, mat map (3 rows of 15, one mat per booking) and waiver pop-up, is saved as `drafts/events/sunrise-beach-pilates.html`. It still says Sat, Nov 7 with booking opening Sat, Oct 31 at 7:00 AM.

To bring it back with a new date:
1. Copy `drafts/events/sunrise-beach-pilates.html` over `events/sunrise-beach-pilates.html`.
2. In that page, change the date and time everywhere it appears (page description, heading, summary list, and the hidden `event` field), the `data-booking-opens` value, and the "Booking opens" line.
3. In `netlify/lib/mats-core.mjs`, set `opens` for `sunrise-beach-pilates` to the booking opening time in UTC (7:00 AM Eastern is 11:00 UTC before Nov 1 and 12:00 UTC after). Until then the mat server accepts no bookings.
4. In `index.html`, swap the Sunrise "Coming soon" date for the new date and add back its time line:

```html
            <time class="event-date" datetime="2026-11-07"><span class="event-month">Nov</span><span class="event-day">7</span><span class="event-weekday">Sat</span></time>
            <div class="event-info">
              <h3>Sunrise Beach Pilates</h3>
              <p class="event-meta">7:00 – 8:30 AM · 45 spots · Location announced soon</p>
```
5. Update the event's start time in the member database's events table.
