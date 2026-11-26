#!/usr/bin/env node
/* self-tests — Quorum. SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 · (c) 2026 Dr Sohil Momin
 * Done-means: with seven votes, the root recomputes on a second device from the seven payloads and matches
 * character for character; flipping one vote changes the root; the tally equals the number of valid signed
 * votes, and a vote with a broken signature is rejected and NAMED. */
"use strict";
var fs = require("fs"), path = require("path");
var ROOT = path.join(__dirname, "..");
var Q = require(path.join(ROOT, "docs", "play", "quorum-core.js"));
var passed = 0, failed = [], group = "";
function section(n) { group = n; }
function ok(n, c, d) { if (c) { passed++; return; } failed.push(group + " :: " + n + (d ? " — " + d : "")); }
function eq(n, a, b) { ok(n, a === b, "expected " + JSON.stringify(b) + ", got " + JSON.stringify(a)); }
function read(f) { return fs.readFileSync(path.join(ROOT, f), "utf8"); }

var KEYS = { Sohil: "k1", Aaji: "k2", Ravi: "k3", Meena: "k4", Baba: "k5", Tai: "k6", Om: "k7" };
var VOTERS = Object.keys(KEYS);
function seven() {
  return VOTERS.map(function (v, i) {
    return Q.cast({ motion: "tea fund", voter: v, choice: i % 3 === 0 ? "against" : "for", at: 1000 + i, key: KEYS[v] }).vote;
  });
}

section("done means — seven votes, and the root recomputes on a second device");
var votes = seven();
eq("seven votes are cast", votes.length, 7);
var r1 = Q.root(votes);
eq("the root is eight characters", r1.length, 8);
var secondDevice = votes.map(function (v) { return Q.fromQr(Q.toQr(v)).vote; });
eq("the payloads survive a QR round trip", secondDevice.length, 7);
eq("and the second device gets the same root", Q.root(secondDevice), r1);
var chk = Q.checkRoot(secondDevice, r1);
eq("character for character", chk.matches, true);
ok("and the app says so", /the same on both devices, character for character/.test(chk.says), chk.says);
eq("a different claimed root does not match", Q.checkRoot(secondDevice, "deadbeef").matches, false);

section("done means — flipping one vote changes the root");
var flipped = votes.map(function (v, i) { return i === 0 ? Object.assign({}, v, { choice: "for" }) : v; });
ok("the root changes", Q.root(flipped) !== r1, Q.root(flipped) + " vs " + r1);
var flippedVoter = votes.map(function (v, i) { return i === 3 ? Object.assign({}, v, { voter: "Someone" }) : v; });
ok("changing a name changes it too", Q.root(flippedVoter) !== r1);
ok("the root is order-independent", Q.root(votes.slice().reverse()) === r1);

section("done means — the tally equals the number of valid signed votes");
var t = Q.tally(votes, KEYS);
eq("seven valid votes", t.total, 7);
eq("none rejected", t.rejected.length, 0);
eq("the counts add up", t.counts["for"] + t.counts.against + t.counts.abstain, 7);
ok("and the app states the counts", /for, .*against, .*abstain/.test(t.says), t.says);
ok("with a disclaimer", /counts valid votes only/.test(t.disclaimer), t.disclaimer);

section("done means — a vote with a broken signature is rejected and NAMED");
var tampered = votes.map(function (v, i) { return i === 0 ? Object.assign({}, v, { choice: "for" }) : v; });
var t2 = Q.tally(tampered, KEYS);
eq("the tally counts only valid votes", t2.total, 6);
eq("one is rejected", t2.rejected.length, 1);
eq("and it is named", t2.rejected[0].voter, "Sohil");
ok("with the reason", /does not match the vote/.test(t2.rejected[0].reason), t2.rejected[0].reason);
ok("and the tally says who", /rejected: Sohil/.test(t2.says), t2.says);
var noKey = Q.verify(votes[0], {});
eq("a vote with no published key cannot be checked", noKey.ok, false);
ok("and is told why", /no key published/.test(noKey.reason), noKey.reason);

section("bad input");
eq("a vote with no motion is refused", Q.cast({ voter: "A", choice: "for", key: "k" }).field, "motion");
eq("a vote with no voter is refused", Q.cast({ motion: "m", choice: "for", key: "k" }).field, "voter");
eq("a vote with no choice is refused", Q.cast({ motion: "m", voter: "A", key: "k" }).field, "choice");
eq("a nonsense choice is refused", Q.cast({ motion: "m", voter: "A", choice: "maybe", key: "k" }).field, "choice");
eq("a vote with no key is refused", Q.cast({ motion: "m", voter: "A", choice: "for" }).field, "key");
eq("a payload that is not a vote is refused", Q.fromQr("hello").ok, false);
eq("a payload missing a field is refused", Q.fromQr("Q1|m|A|for|1|").ok, false);

section("must-not — no network, and the signing is named honestly");
var core = read("docs/play/quorum-core.js");
ok("no fetch, XHR, WebSocket or beacon", !/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource/.test(core.replace(/\/\*[\s\S]*?\*\//g, "") + read("docs/play/app.js")));
ok("no URL in the engine", !/https?:\/\//.test(core));
ok("the page forbids connections", /connect-src 'none'/.test(read("docs/play/index.html")));
ok("the page says signing is a checksum, not a signature", /keyed checksum, not a cryptographic signature/.test(read("docs/play/index.html")));
/* the comment wraps across lines, so match on whitespace */
/* the comment wraps across lines with a leading ' * ', so normalise before matching */
var flat = core.replace(/\n\s*\*\s?/g, " ");
ok("the engine says the same", /NOT a cryptographic signature/.test(flat), "phrase not found");

section("storage");
var bad = Q.parseState("{ broken ballot");
eq("a broken ballot is reported", bad.ok, false);
eq("it is marked unreadable", bad.unreadable, true);
ok("it was not replaced with an empty one", /NOT replaced with an empty ballot/.test(bad.reason), bad.reason);
ok("and says why an empty ballot is worse", /nobody voted/.test(bad.reason), bad.reason);
eq("nothing saved yet is distinguished", Q.parseState("").empty, true);
var round = Q.parseState(Q.serialize(votes));
eq("the ballot round-trips", round.votes.length, 7);
eq("and the root is the same", Q.root(round.votes), r1);
var thrown = Q.exportFile("ballot", { votes: votes }, { when: "26/11/2026" }, function () { var e = new Error("q"); e.name = "QuotaExceededError"; throw e; });
eq("a failed write is reported", thrown.ok, false);

section("shape — every script the page loads exists beside it");
var page = read("docs/play/index.html");
var srcs = (page.match(/<script[^>]+src="([^"]+)"/g) || []).map(function (t) { return t.replace(/.*src="([^"]+)"/, "$1"); });
srcs.forEach(function (x) { ok("script src resolves: " + x, fs.existsSync(path.join(ROOT, "docs", "play", x.replace(/^\.\//, "")))); });
ok("the landing page exists", fs.existsSync(path.join(ROOT, "docs", "index.html")));
ok("the page manifest exists", fs.existsSync(path.join(ROOT, "PAGES.json")));
ok("the web manifest exists", fs.existsSync(path.join(ROOT, "docs", "play", "manifest.webmanifest")));

var total = passed + failed.length;
if (!total) { console.error("self-tests: 0 assertions ran."); process.exit(1); }
if (failed.length) { console.error("self-tests: " + passed + "/" + total + " passed, " + failed.length + " FAILED"); failed.slice(0, 12).forEach(function (f) { console.error("  FAIL " + f); }); process.exit(1); }
console.log("self-tests: " + passed + "/" + total + " assertions passed");
