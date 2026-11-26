/* quorum-core — the engine behind Quorum.
 * SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 * (c) 2026 Dr Sohil Momin
 *
 * ONE JOB: collect signed votes from people in a room, and produce a tally everyone can check by
 * recomputing it themselves.
 *
 * THE ROOT IS THE POINT: a hash over the seven vote payloads, shown as a QR. A second device recomputes it
 * from the same payloads and gets the same string, character for character — or it does not, and everyone
 * can see that it does not. Flip one vote and the root changes.
 *
 * A VOTE WITH A BROKEN SIGNATURE IS REJECTED AND NAMED. Signing here is a keyed hash (FNV-1a over the
 * payload with the voter's key), which is enough to catch a mangled or edited payload and is NOT a
 * cryptographic signature — the README says so plainly rather than implying otherwise.
 *
 * THE TRANSPORT IS NOT BUILT: no camera, no QR scanner. A payload is text you can paste or scan by hand,
 * and the root is text too.
 *
 * Pure functions: no DOM, no network, no storage.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.QuorumCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var VERSION = "1.0.0";
  function clean(s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim(); }

  /* FNV-1a, 32-bit, hex. A checksum, not a signature — and named as one everywhere. */
  function h32(text) {
    var h = 0x811c9dc5, s = String(text);
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
    return ("00000000" + h.toString(16)).slice(-8);
  }

  function payload(vote) {
    return [vote.motion, vote.voter, vote.choice, vote.at].join("|");
  }

  function sign(vote, key) { return h32(payload(vote) + "|" + String(key == null ? "" : key)); }

  /* A vote: for or against, by a named person, at a time, signed with their key. */
  function cast(input) {
    var motion = clean(input && input.motion);
    var voter = clean(input && input.voter);
    var choice = clean(input && input.choice).toLowerCase();
    var key = clean(input && input.key);
    if (!motion) return { ok: false, field: "motion", reason: "a vote needs a motion to be about" };
    if (!voter) return { ok: false, field: "voter", reason: "a vote needs a voter" };
    if (choice !== "for" && choice !== "against" && choice !== "abstain") return { ok: false, field: "choice", reason: "\u201c" + choice + "\u201d is not a vote (for, against or abstain)" };
    if (!key) return { ok: false, field: "key", reason: "a vote needs a key to sign it, or it cannot be checked by anyone" };
    var at = Number(input && input.at) || 0;
    var v = { motion: motion, voter: voter, choice: choice, at: at };
    v.sig = sign(v, key);
    return { ok: true, vote: v, says: voter + " voted " + choice + " on \u201c" + motion + "\u201d." };
  }

  /* Verify one vote against the key its voter published. A broken one is NAMED. */
  function verify(vote, keys) {
    var k = keys && keys[vote.voter];
    if (k == null) return { ok: false, voter: vote.voter, reason: "no key published for " + vote.voter + ", so the vote cannot be checked" };
    if (sign(vote, k) !== vote.sig) return { ok: false, voter: vote.voter, reason: "the signature from " + vote.voter + " does not match the vote \u2014 it was edited after signing" };
    return { ok: true, voter: vote.voter };
  }

  /* The tally: only VALID votes count, and the rejected ones are named rather than dropped silently. */
  function tally(votes, keys) {
    var valid = [], rejected = [];
    (votes || []).forEach(function (v) {
      var out = verify(v, keys);
      if (out.ok) valid.push(v); else rejected.push({ voter: v.voter, reason: out.reason });
    });
    var counts = { for: 0, against: 0, abstain: 0 };
    valid.forEach(function (v) { counts[v.choice] = (counts[v.choice] || 0) + 1; });
    return {
      ok: true, valid: valid, rejected: rejected, counts: counts, total: valid.length,
      passed: counts["for"] > counts["against"],
      says: counts["for"] + " for, " + counts.against + " against, " + counts.abstain + " abstain \u2014 from " + valid.length + " valid vote(s)." +
        (rejected.length ? " " + rejected.length + " rejected: " + rejected.map(function (r) { return r.voter; }).join(", ") + "." : ""),
      disclaimer: "The tally counts valid votes only. A vote whose signature does not match is rejected and named."
    };
  }

  /* THE ROOT: a hash over the payloads in a fixed order, so two devices can compare one short string. */
  function root(votes) {
    var rows = (votes || []).map(payload).sort();
    return h32(rows.join("\n"));
  }

  /* A second device recomputes the root from the payloads it was handed and compares. */
  function checkRoot(votes, claimed) {
    var mine = root(votes);
    return {
      ok: true, root: mine, claimed: clean(claimed), matches: mine === clean(claimed),
      says: mine === clean(claimed)
        ? "Root " + mine + " \u2014 the same on both devices, character for character, from " + (votes || []).length + " payload(s)."
        : "The root here is " + mine + " and the claimed root is " + clean(claimed) + ". They do NOT match: something differs between the two copies."
    };
  }

  /* A QR-sized string per vote, and back again — this is what a scan would carry. */
  function toQr(vote) { return "Q1|" + [vote.motion, vote.voter, vote.choice, vote.at, vote.sig].join("|"); }
  function fromQr(text) {
    var parts = String(text || "").split("|");
    if (parts.length !== 6 || parts[0] !== "Q1") return { ok: false, reason: "that is not a Quorum vote payload" };
    var v = { motion: parts[1], voter: parts[2], choice: parts[3], at: Number(parts[4]) || 0, sig: parts[5] };
    if (!v.motion || !v.voter || !v.sig) return { ok: false, reason: "the payload is missing a field" };
    return { ok: true, vote: v };
  }

  function serialize(votes) { return JSON.stringify({ version: VERSION, format: "quorum-1", votes: (votes || []).slice() }, null, 2); }
  function parseState(text) {
    var raw = String(text == null ? "" : text);
    if (!raw.trim()) return { ok: false, empty: true, reason: "no vote has been cast on this device yet", raw: raw };
    var data;
    try { data = JSON.parse(raw); }
    catch (e) { return { ok: false, unreadable: true, reason: "The saved votes cannot be read. They were NOT replaced with an empty ballot \u2014 an empty ballot looks like nobody voted. Export it to keep it.", raw: raw }; }
    if (!data || !Array.isArray(data.votes)) return { ok: false, unreadable: true, reason: "The saved file holds no votes. Nothing was started over it; export it to keep it.", raw: raw };
    return { ok: true, votes: data.votes, raw: raw };
  }
  function stamp(when) { var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(when || "")); return m ? m[3] + "-" + m[2] + "-" + m[1] : "undated"; }
  function exportFile(what, payloadIn, meta, writer) {
    meta = meta || {};
    if (typeof writer !== "function") return { ok: false, reason: "the file was not written: no writer is available in this browser" };
    var name, body, mime = "application/json";
    if (what === "ballot") { name = "quorum-" + stamp(meta.when) + ".json"; body = serialize(payloadIn.votes); }
    else if (what === "raw") { name = "quorum-unreadable-" + stamp(meta.when) + ".txt"; body = String(payloadIn.raw || ""); mime = "text/plain;charset=utf-8"; }
    else return { ok: false, reason: "nothing was written: unknown export \u201c" + what + "\u201d" };
    try {
      var wrote = writer(name, body, mime);
      if (wrote === false) return { ok: false, filename: name, reason: "the file was not written: the browser refused the save" };
      return { ok: true, filename: name, bytes: body.length };
    } catch (e) {
      var why = e && e.name === "QuotaExceededError" ? "storage is full" : (e && e.message ? e.message : "storage is unavailable");
      return { ok: false, filename: name, reason: "the file was not written: " + why };
    }
  }

  return { version: VERSION, h32: h32, payload: payload, sign: sign, cast: cast, verify: verify, tally: tally,
    root: root, checkRoot: checkRoot, toQr: toQr, fromQr: fromQr,
    serialize: serialize, parseState: parseState, exportFile: exportFile };
});
