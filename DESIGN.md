# Terserah — Design System

## Scene

Two people, 7pm, parked car or sofa, hungry, phone brightness up, mildly annoyed
with each other, deciding in under two minutes.

Evening. Phone in hand. Low ambient light. The mood is a stand-off, not a cheerful
picker. **The theme is dark** — not because tools look cool dark, because it is 7pm.

## Concept: the night court

The product's own vocabulary is judicial — vonis, hakim, putusan, banding. The visual
language follows it literally: an official decree, read out in a dark room. Formal
bureaucratic chrome (case numbers, timestamps, stamped labels) wrapped around
content that is savage. **The humour is the contrast between the formality and the
insult.** Deadpan beats loud.

### Explicitly rejected

The source PDF proposed neon pink/yellow brutalism with thick black borders. Rejected
on the reflex test: given "Gen Z viral roast app", that is the palette everyone
guesses. The obvious anti-reflex — newspaper editorial, or terminal green — is the
same trap one tier deeper. The night-court decree is neither.

## Color

Strategy: **committed**. Dark ink carries the surface, one stamp red carries identity,
and exactly one bright object exists on screen — the decree card.

OKLCH throughout. Neutrals are tinted toward the brand's own red hue, never
warm-by-default.

```css
--ink:         oklch(0.17 0.015 25);  /* body ground */
--ink-raised:  oklch(0.22 0.018 25);  /* inputs, raised chrome */
--ink-line:    oklch(0.32 0.020 25);  /* hairlines */

--stamp:       oklch(0.58 0.210 27);  /* brand red — fills, borders, large type */
--stamp-lift:  oklch(0.68 0.180 27);  /* red at body text size (contrast) */

--decree:      oklch(0.94 0.008 40);  /* the verdict card surface, ONLY here */
--decree-ink:  oklch(0.20 0.010 40);  /* text on the card */

--bone:        oklch(0.92 0.006 40);  /* body text on ink */
--muted:       oklch(0.68 0.012 25);  /* labels, meta */
--seal:        oklch(0.60 0.100 110); /* brass — the "accepted" path only */
```

`--decree` is a light warm-ish surface, which the cream/sand ban targets. It is
permitted here because it is not the body background — it is a single card rendered
as a physical paper object lit in a dark room, which is the entire concept. Chroma is
0.008 and tinted toward the red hue, not toward generic warmth. It must never spread
to the page background.

Contrast: `--bone` and `--muted` on `--ink` both clear 4.5:1. `--stamp` is for ≥18px
or bold-≥14px only; use `--stamp-lift` for red at body size. `--decree-ink` on
`--decree` clears easily. Placeholders use `--muted`, not a lighter gray.

## Typography

Two families, paired on a real contrast axis (condensed display vs monospace).

- **Anton** — the verdict line, the score, the big statement. Stamped, compressed,
  authoritative. One weight, that's the point.
- **IBM Plex Mono** — everything else: labels, buttons, body, case numbers. Mono as
  body text is legible here because no surface in this app carries long prose.

No third family. No Inter.

- Verdict display: `clamp(2.5rem, 12vw, 5.5rem)`, letter-spacing `-0.02em`
  (Anton is already condensed; do not tighten toward the -0.04em floor).
- Body: 16px, max 60ch, `text-wrap: pretty`.
- Headings h1–h3: `text-wrap: balance`.
- The roast is two sentences. If it needs 65ch it is too long — fix the prompt, not
  the measure.

Bureaucratic mono labels (`PERKARA NO.`, `PIHAK A`) are a deliberate brand system,
not the tracked-caps eyebrow reflex: they appear only where a real document would
carry one, never as a decorative kicker above every section.

## Motion

One investment, one place: the beat between B's submit and the verdict.

**Deliberation sequence** — not a spinner. Mono lines type out in sequence like a
court reading (`MENIMBANG…` → `MENGADILI…` → `MEMUTUSKAN…`), ~2.5s total. Then the
decree card lands: scale from 1.06 → 1, a ~1.5° rotation settling to 0, and a short
shadow bloom. A stamp hitting paper. `ease-out-expo`, ~420ms.

Everything else: 150–200ms `ease-out-quart` on transform/opacity only.

`prefers-reduced-motion: reduce` — the deliberation text appears complete and static,
the card crossfades in. No typing, no scale, no rotation.

Content is visible by default. No reveal is gated behind a class-triggered transition.

## Layout

- Mobile-first. Single column, `min(100% - 2rem, 34rem)`, centered.
- The verdict screen is one viewport, no scroll, so a screenshot captures it whole.
- No card grids anywhere. There is exactly one card in the product and it is the
  decree.
- z-index scale: `--z-sticky: 10; --z-overlay: 20; --z-toast: 30`. Nothing else.

## Bans in force

No gradient text. No glassmorphism. No side-stripe borders. No hero-metric block. No
identical card grids. No numbered section markers. No tracked-caps eyebrows as
scaffolding. Test every heading at 320px — Anton at a large clamp overflows fast.
