# Landing Page (L0) — Judge-Facing Surface

A standalone static site — **not** part of the in-app React Native design system. It exists purely as the hackathon presentation surface: problem-first narrative, the diagnosis screen (S4) rendered as the hero visual, and a "try the app" CTA.

## Run locally

It's plain HTML/CSS — no build step. Either:

```bash
# Option A: just open the file
start index.html        # Windows

# Option B: serve it (better — keeps relative paths clean)
python -m http.server 8090
# then open http://localhost:8090
```

## Deploy

Drag the `landing/` folder into Netlify/Vercel, or push to GitHub Pages. No bundler required.

## Wiring the "Open the app" button

The CTA button (`#open-app`) currently points to `#`. Before the demo, set its `href` to the deployed Expo web build URL (or replace with a QR code image) so judges can open the prototype on their own device.

## Fonts

Uses **Inter** (Latin) + **Noto Sans Devanagari** (Hindi) from Google Fonts, per the design system's fallback guidance for Gilroy. If demoing offline, the page degrades gracefully to system fonts.
