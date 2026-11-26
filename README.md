# Quorum

Signed votes, a tally that names what it rejected, and a **root anyone can recompute** — character for
character.

- **Demo:** https://drsamonline.github.io/app-quorum/play/index.html
- **Landing page:** https://drsamonline.github.io/app-quorum/
- **Release:** https://github.com/drsamonline/app-quorum/releases/tag/app-latest
- **Plan row:** #35 of 37 in `drsamonline/forge` → `QUEUE/PLAN.json`
- **Specs absorbed:** `app-quorum` (lead)
- **Licence:** PolyForm Noncommercial 1.0.0

## Status

| | |
|---|---|
| **Built** | Signed votes; verification against published keys; a tally counting valid votes only; rejected votes named; a root over the payloads that a second device recomputes; payload strings per vote. |
| **Release** | Windows EXE, Android APK and Linux binary, built from this source by `app-builder` in CI. |
| **Not built** | **A camera, a QR scanner, and real cryptography.** The signing is a keyed checksum and the page says so. |
| **Untested** | A room of seven people passing payloads around. The arithmetic is exact; whether a QR on a phone screen scans reliably in a hall is not something a test can see. |

## The spec's "done means", counted

| The spec says | Test |
|---|---|
| with seven votes, the root recomputes on a second device and matches character for character | seven payloads round-trip through the QR string, and both sides compute the same eight characters |
| flipping one vote changes the root | flipping one choice changes it, and so does changing one name |
| the tally equals the number of valid signed votes | 7 valid; after one tampered vote, 6 valid and 1 rejected |
| a vote with a broken signature is rejected and **named** | rejected, `voter === "Sohil"`, reason given, and the tally sentence names them |
| the exchange works by scanning QRs, with the internet off | payloads are single lines and round-trip; no `fetch`/XHR/WebSocket/beacon, no URL, CSP `connect-src 'none'` |

## The honest limit, stated on the page

Signing is **FNV-1a over the payload and the voter's key** — a keyed checksum. It catches a mangled or edited
payload and it is **not** a cryptographic signature: no key exchange, no protection against someone who knows
the key, no defence against a determined forger. The page, NOTICE and README all say this rather than letting
the word "signed" imply more than it delivers.

## What it will not do

- **Count an invalid vote.**
- **Drop a rejected vote silently** — it is named.
- **Claim cryptographic security.**
- **Use the internet.**

## When things go wrong

| Case | Behaviour |
|---|---|
| **Bad input** | Every refusal names the field: motion, voter, choice, key, payload. |
| **A tampered vote** | Rejected, named, left out of the tally — and the root changes, so the disagreement is visible. |
| **No network** | Nothing changes. |
| **Storage full or unavailable** | **NOT SAVED**, ballot unchanged. |
| **Corrupt saved state** | Reported and offered for export, never replaced with an empty ballot. |

## Tests

```bash
npm test                      # all three suites
node tests/self-tests.js      # engine — 49 assertions
node tests/ui-tests.js        # the page in jsdom — 16 assertions
node tests/page-smoke.js      # every local src/href resolves, nothing off-origin
```

Mutation-tested six ways on 26/11/2026, all red: a tampered vote accepted (crash), the root ignoring the
votes (3 failures), the root depending on order (2), a rejected vote dropped silently (crash), a broken ballot
starting empty (5), and a vote needing no key (2).

## A test that failed twice on wording, not on code

My "the engine says signing is a checksum" check failed twice: first because the phrase wraps across lines,
then because the wrapped line begins with a ` * ` comment decoration that `\s+` does not match. It now
normalises the comment before matching. That is the third variant of this same problem in the fleet — **a
static check on prose has to survive line wrapping and comment decoration**, or it is testing the formatting.

## Layout

```
docs/index.html            landing page
docs/play/index.html       the app — cast, the tally, the root, the payloads
docs/play/app.js           DOM wiring: cast, tally, root comparison, payloads, export
docs/play/quorum-core.js   the engine — signing, verification, tally, root, payloads, storage
docs/play/web-kit.js       vendored kit (unmodified)
docs/play/export-kit.js    vendored kit (unmodified)
tests/self-tests.js        engine suite (49)
tests/ui-tests.js          page suite (16, jsdom)
tests/page-smoke.js        shape on disk
PAGES.json                 landing = docs/index.html, app = docs/play/index.html
```

## Where the spec was silent, and what was chosen

- **The root is over sorted payloads**, so two devices agree regardless of the order votes arrived in — order-independence is what makes a short string comparable.
- **A rejected vote is named, not dropped**, because the spec says "rejected and named" and a silent drop is the failure mode of every bad tally.
- **Abstain is a real choice**, counted and shown, because a room that cannot abstain will invent a third option badly.
- **The payload is one line** — motion, voter, choice, time, signature — so it is exactly what a QR could hold.
- **The limit is stated three times**: page, NOTICE, README. "Signed" is a word people trust more than a checksum deserves.

## What is not built, and why

**A camera and real cryptography.** The first needs a scanner this fleet does not open; the second is a
serious piece of work, and a fake would be worse than an honest checksum with the limit written on it.
