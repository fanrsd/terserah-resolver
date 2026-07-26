# Terserah — Design System

## Scene

Two people, 7pm, parked car or sofa, hungry, phone brightness up, mildly annoyed
with each other, deciding in under two minutes.

Evening. Phone in hand. Low ambient light. The mood is a stand-off, not a cheerful
picker. **The theme is dark** — not because tools look cool dark, because it is 7pm.

## Concept: the night court

The product's own vocabulary is judicial — vonis, hakim, putusan, banding. The visual
language follows it literally: an official decree, read out in a dark room. Formal
bureaucratic chrome (case numbers, stamped labels) wrapped around content that is
savage. **The humour is the contrast between the formality and the insult.** Deadpan
beats loud.

### Explicitly rejected

The source PDF proposed neon pink/yellow brutalism with thick black borders. Rejected
on the reflex test: given "Gen Z viral roast app", that is the palette everyone
guesses.

The obvious anti-reflex is the same trap one tier deeper. Built as *display serif +
mono labels + ruled separators*, "night court" lands squarely in the
**editorial-typographic** lane that impeccable lists as currently saturated. What
keeps it out: the display face is a condensed heavy sans, not a serif, and the mono is
a typewriter rather than a terminal face. Condensed black + typewriter + oxblood on
near-black reads as *police evidence / court summons*, not as a magazine.

## Two registers

- **Public surfaces** (`/`, `/r/[id]`) are the brand. The verdict is the artifact
  that gets screenshotted into a group chat, so it gets the commitment.
- **Admin** (`/admin/*`) is product register: a tool. Same tokens and fonts, but
  dense, quiet, and functional — no decree sheets, no stamps, no display type beyond
  the page title. Tables and stats are the correct affordance there.

## Color

Strategy: **committed**. Dark ink carries the surface, one stamp red carries identity,
and exactly one bright object exists on screen — the decree card.

OKLCH throughout. Neutrals are tinted toward the brand's own red hue, never
warm-by-default.

```css
--ink:         oklch(0.17 0.015 25);  /* body ground */
--ink-raised:  oklch(0.22 0.018 25);  /* inputs, raised chrome */
--ink-line:    oklch(0.32 0.020 25);  /* hairlines */

--stamp:       oklch(0.58 0.210 27);  /* display-size only: 4.03:1 on ink */
--stamp-lift:  oklch(0.68 0.180 27);  /* small red text on dark: 6.15:1 */
--stamp-deep:  oklch(0.48 0.190 27);  /* small red text on the sheet: 6.02:1 */

--decree:      oklch(0.94 0.008 40);  /* the verdict card surface, ONLY here */
--decree-ink:  oklch(0.20 0.010 40);  /* text on the card: 15.1:1 */

--bone:        oklch(0.92 0.006 40);  /* body text on ink: 15.1:1 */
--muted:       oklch(0.68 0.012 25);  /* labels, meta, placeholders: 6.65:1 */
--seal:        oklch(0.60 0.100 110); /* brass, the "accepted" path: 4.93:1 on ink */
--seal-deep:   oklch(0.46 0.090 110); /* brass on the sheet: 5.86:1 */
```

`--decree` is a light warm-ish surface, which the cream/sand ban targets. It is
permitted here because it is not the body background — it is a single card rendered
as a physical paper object lit in a dark room, which is the entire concept. Chroma is
0.008 and tinted toward the red hue, not toward generic warmth. It must never spread
to the page background.

**Three reds, on purpose.** `--stamp` clears only 3:1, so it is reserved for display
type and fills. Small red text takes `--stamp-lift` on dark or `--stamp-deep` on the
sheet. The same split applies to brass. Every pair above is measured, not estimated.

## Typography

Voice words: **stamped, nocturnal, blunt.** Physical object: a summons typed on a
court typewriter, stamped in red, read on a phone at night.

The reflex picks were IBM Plex Mono, Space Mono, and JetBrains Mono. The first two are
on impeccable's reflex-reject list and the third is the same reflex wearing a hat; all
three were rejected.

- **Anton** — the verdict, the summons headline, the big statement. Condensed, heavy,
  one weight. A stamp, not a poster font.
- **Courier Prime** — everything else: labels, buttons, body, case numbers. This is
  the screenwriter's Courier, so it reads as *official typed document* rather than
  *developer terminal*, which is what the brand-register ban on decorative monospace
  is actually about.

Mono as body text works here because no surface carries long prose; the roast is two
sentences.

**Weight rule.** Light type on dark reads lighter, so `body` sets Courier at 700 and
the decree sheet resets to 400. Dark-on-light gets the regular weight, light-on-dark
gets the bold. One rule, no per-component guessing.

- Verdict display: `clamp(1.75rem, 9.5vw, 3.5rem)`, `break-words`. Long franchise
  names overflow a 320px card fast; this was measured, not assumed.
- Display letter-spacing `-0.01em`. Anton is already condensed — the -0.04em floor
  would collide the letters.
- Body 16px, max 60ch, `text-wrap: pretty`. Headings `text-wrap: balance`.

Bureaucratic labels (`PERKARA NO.`, `CATATAN HAKIM`) are a deliberate brand system,
not the tracked-caps eyebrow reflex: they appear only where a real document carries a
field label, never as a decorative kicker above every section.

## Signature motif: the stamp

The hero object, and the reason the page is not typography-only. An inked rubber stamp
struck across the decree, drawn as SVG with `feTurbulence` + `feDisplacementMap`
roughening the edges so it reads as pressed rubber rather than a vector rectangle,
plus `mix-blend-multiply` so the ink sits into the paper.

Two states, which is how the two endings stay visually distinct:

| Outcome | Label | Tone |
|---|---|---|
| B protested, judge ruled | `FINAL` / tidak dapat diganggu gugat | `--stamp-deep` |
| B surrendered, A's pick stands | `TANPA LAWAN` / hak suara tidak digunakan | `--seal-deep` |

The stamp's sub-line is an image of text at 10.5px, so it takes the 4.5:1 bar, not the
3:1 graphics bar. That is why both tones are the deep variants.

The landing renders the same component as a labelled specimen — it gives the page its
visual anchor and shows cold traffic what they get, in one move.

## Motion

One investment, one place: the beat between B's submit and the verdict.

**Deliberation sequence** — not a spinner. Mono lines type out in sequence like a
court reading (`Menimbang…` → `Mengadili…` → `Memutuskan…`), ~2.25s, held to a 2.4s
floor even when the model answers faster, because the reading is the drama. Then the
decree lands: scale 1.07 → 1 with a 1.6° rotation settling to 0, and the stamp hits
380ms later at `rotate(-14deg) scale(1.9)` → `rotate(-9deg) scale(1)`. `ease-out-expo`.

Everything else: 150ms `ease-out-quart` on transform/opacity only.

`prefers-reduced-motion: reduce` — all three lines appear at once, the card and stamp
crossfade in place. Verified in-browser, not assumed.

Content is visible by default. No reveal is gated behind a class-triggered transition.

## Layout

- Mobile-first. Single column, `min(100% - 2rem, 34rem)`; admin widens to `64rem`
  because a table needs it.
- The verdict screen is one viewport, no scroll, so a screenshot captures it whole.
- No card grids anywhere. There is exactly one card in the product and it is the
  decree.
- z-index scale: `--z-sticky: 10; --z-overlay: 20; --z-toast: 30`. Nothing else.

## Bans in force

No gradient text. No glassmorphism. No side-stripe borders. No hero-metric block. No
identical card grids. No numbered section markers as scaffolding — the two numbered
lists that exist (`Tata cara`, the three dealbreakers) are real ordered sequences. No
tracked-caps eyebrows as section grammar. Every heading tested at 320px.
