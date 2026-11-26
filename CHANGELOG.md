# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Dates: dd/mm/yyyy.

## [Unreleased]

## [1.0.0] — 26/11/2026

### Added
- **Votes** — for, against or abstain — signed with the voter's key (a keyed checksum, named as such).
- **Verification** against each voter's published key; an edited vote is rejected **and named**, with the reason.
- **A tally** that counts valid votes only, states the counts, and lists what it rejected.
- **The root**: a hash over the vote payloads in sorted order, which a second device recomputes and compares
  character for character. Flipping one vote changes it.
- **Payload strings** per vote — the line a QR would carry — with a round trip back into a vote.
- Refusals: no motion, no voter, no choice, a nonsense choice, no key, a payload that is not a vote.
- An unreadable ballot is reported and offered for export, **never** replaced with an empty one — an empty
  ballot looks like nobody voted.
- A failed save says **NOT SAVED** and leaves the ballot unchanged.
- PWA shell, CI (49 engine assertions + 16 in jsdom + page smoke), and the app-builder pipeline pinned to the
  canonical SHA for the EXE/APK/Linux release.

### Not built
- A camera and a QR scanner, and **real cryptography**. The signing is a checksum, and the page says so.
