# Terserah

Working title: **Terserah** (repo `terserahresolver`). Domain target: `terserah.app`.

## What it is

A one-shot web arbitrator for the most repetitive conflict in any relationship:
"mau makan di mana?" answered with "terserah".

One person is stuck. They open the site, name one deliberately unappealing place,
and send the link. The other person opens it and finds the decision already made
against them. Their only real move is to protest — and protesting means finally
saying what they *don't* want. The AI takes both inputs and issues a final verdict,
roasting both sides equally.

Not a recommendation engine. A judge. The decision is the product; the roast is the
distribution.

## Register

`product` for the input flow, `brand` for the verdict surface.

The verdict screen is the growth engine — it is the artifact that gets screenshotted
into a WhatsApp group of 200 people. It gets brand-grade commitment. The two input
screens get product-grade restraint and speed.

## Platform

`web`. Mobile-first, ~95% of sessions are a phone opening a WhatsApp link at night.

## Market

Indonesia-first. "Terserah" has no single-word English equivalent; the name locks the
market. Copy is casual Indonesian, deadpan.

Copy is **not gendered**. The PDF source framed this as cowok/cewek. Stripped — it
also happens between friends, roommates, and families, and gendering it alienates
half the audience.

## Users

- **Pihak A** — the one who is tired of deciding. Creates the room in under 15 seconds.
- **Pihak B** — the one who said "terserah". Arrives cold via a WhatsApp link, has no
  intention of filling out a form, and must be provoked into it.

B's unwillingness is the central design constraint. Every screen B sees must be
readable and dismissible in three seconds.

## Success criteria

1. A can create and share a room in under 15 seconds, no account.
2. B who opens the link either accepts or protests — the dead-end (close tab) rate
   is the primary metric to beat.
3. Both parties find the verdict funny. If only A laughs, the loop is broken and the
   app has caused a fight instead of ending one.
4. The verdict screen is screenshot-worthy without cropping.

## Scope

**In:** one category — food. Two-party rooms. No accounts. Indonesian only.

**Out (and why):** other decision categories (nonton apa, ke mana) — the
restaurant-knowledge problem is only solved for food; add when food works. Accounts,
history, streaks, payments, 3+ party rooms, English.

## Constraints

- Zero-auth. A room is a random slug with a 24h TTL.
- The AI must never produce a blank or broken screen. Every path terminates in a card.
- LLM cost is real and the endpoint is public — rate limiting is not optional.
- Marginal cost per room must stay near zero under a viral spike. The LLM call is the
  only paid unit; place lookup is restricted to the free IDs-only Places SKU and must
  never ask for a name-bearing field. See §2 of the design doc.
