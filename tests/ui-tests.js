#!/usr/bin/env node
/* ui-tests — the Quorum page in a real DOM (jsdom). SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 · (c) 2026 Dr Sohil Momin */
"use strict";
var fs = require("fs"), path = require("path"), { JSDOM } = require("jsdom");
var ROOT = path.join(__dirname, ".."), PLAY = path.join(ROOT, "docs", "play");
var passed = 0, failed = [];
function ok(n, c, d) { if (c) { passed++; return; } failed.push(n + (d ? " — " + d : "")); }
function eq(n, a, b) { ok(n, a === b, "expected " + JSON.stringify(b) + ", got " + JSON.stringify(a)); }
function build(seed) {
  var dom = new JSDOM(fs.readFileSync(path.join(PLAY, "index.html"), "utf8"), { url: "https://example.test/play/index.html", runScripts: "outside-only", pretendToBeVisual: true });
  var w = dom.window;
  if (seed) Object.keys(seed).forEach(function (k) { w.localStorage.setItem(k, seed[k]); });
  w.URL.createObjectURL = function () { return "blob:x"; }; w.URL.revokeObjectURL = function () {};
  w.HTMLAnchorElement.prototype.click = function () {};
  ["web-kit.js", "export-kit.js", "quorum-core.js", "app.js"].forEach(function (f) { w.eval(fs.readFileSync(path.join(PLAY, f), "utf8")); });
  return dom;
}
var dom = build(null), w = dom.window, d = w.document, $ = function (id) { return d.getElementById(id); };
ok("the engine loaded", !!w.QuorumCore);
ok("the signing limit is stated", /keyed checksum, not a cryptographic signature/.test(d.body.textContent));

var VOTERS = [["Sohil", "k1", "against"], ["Aaji", "k2", "for"], ["Ravi", "k3", "for"], ["Meena", "k4", "for"], ["Baba", "k5", "against"], ["Tai", "k6", "for"], ["Om", "k7", "for"]];
VOTERS.forEach(function (v) {
  $("voter").value = v[0]; $("key").value = v[1]; $("choice").value = v[2];
  $("castBtn").click();
});
eq("seven votes are cast", d.querySelectorAll("#voteList li").length, 7);
ok("the tally states the counts", /for, .*against, .*abstain/.test($("tallySays").textContent), $("tallySays").textContent);
ok("nothing is rejected", !/rejected/.test($("rejectList").textContent), $("rejectList").textContent);
var root = $("rootText").textContent;
eq("the root is eight characters", root.length, 8);

$("claimed").value = root; $("checkBtn").click();
ok("a matching claimed root is accepted", /the same on both devices/.test($("status").textContent), $("status").textContent);
$("claimed").value = "deadbeef"; $("checkBtn").click();
ok("a different root does not match", /do NOT match/.test($("status").textContent), $("status").textContent);

/* a tampered payload, pasted in */
var first = d.querySelector("#qrList li").textContent;
var tampered = first.replace("|against|", "|for|");
$("qrIn").value = tampered; $("qrBtn").click();
ok("a tampered payload is added but rejected", /does not match the vote/.test($("rejectList").textContent), $("rejectList").textContent);
ok("and the voter is named", /Sohil/.test($("rejectList").textContent));
ok("the tally counts only valid votes", /from 7 valid vote/.test($("tallySays").textContent), $("tallySays").textContent);

$("exportBtn").click();
ok("the ballot exports", /Wrote quorum-\d{4}-\d\d-\d\d\.json/.test($("ioNote").textContent), $("ioNote").textContent);
var saved = w.localStorage.getItem("quorum:ballot");
var dom2 = build({ "quorum:ballot": saved });
var d2 = dom2.window.document;
eq("the reload keeps the votes", d2.querySelectorAll("#voteList li").length, 8);

var dom3 = build({ "quorum:ballot": "{ broken ballot" });
var d3 = dom3.window.document;
ok("a broken ballot is reported", /cannot be read/.test(d3.getElementById("status").textContent));
ok("and not replaced with an empty one", /NOT replaced with an empty ballot/.test(d3.getElementById("status").textContent));

var dom4 = build(null), w4 = dom4.window, d4 = dom4.window.document;
Object.defineProperty(w4, "localStorage", { configurable: true, get: function () {
  return { getItem: function () { return null; }, setItem: function () { var e = new Error("q"); e.name = "QuotaExceededError"; throw e; }, removeItem: function () {}, clear: function () {} }; } });
d4.getElementById("castBtn").click();
ok("a failed save says NOT SAVED", /NOT SAVED:/.test(d4.getElementById("status").textContent), d4.getElementById("status").textContent);

var total = passed + failed.length;
if (!total) { console.error("ui-tests: 0 assertions ran."); process.exit(1); }
if (failed.length) { console.error("ui-tests: " + passed + "/" + total + " passed, " + failed.length + " FAILED"); failed.forEach(function (f) { console.error("  FAIL " + f); }); process.exit(1); }
console.log("ui-tests: " + passed + "/" + total + " assertions passed");
