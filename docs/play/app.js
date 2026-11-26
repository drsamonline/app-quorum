/* app — the Quorum page. SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 · (c) 2026 Dr Sohil Momin
 * Wiring only: the signing, the tally and the root live in quorum-core.js. */
(function () {
  "use strict";
  var Q = window.QuorumCore;
  var $ = function (id) { return document.getElementById(id); };
  var K = "quorum:ballot";
  var state = { votes: [], keys: {}, unreadable: null };

  var els = {
    status: $("status"), motion: $("motion"), voter: $("voter"), choice: $("choice"), key: $("key"), castBtn: $("castBtn"), voteList: $("voteList"),
    tallySays: $("tallySays"), rejectList: $("rejectList"), rootText: $("rootText"), rootSays: $("rootSays"),
    claimed: $("claimed"), checkBtn: $("checkBtn"), qrIn: $("qrIn"), qrBtn: $("qrBtn"), qrList: $("qrList"),
    exportBtn: $("exportBtn"), ioNote: $("ioNote")
  };

  function today() { var d = new Date(), p = function (n) { return (n < 10 ? "0" : "") + n; }; return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear(); }
  function setStatus(k, m) { els.status.className = "status show " + k; els.status.textContent = m; }
  function node(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }

  function persist() {
    try { window.localStorage.setItem(K, Q.serialize(state.votes)); return true; }
    catch (e) { setStatus("bad", "NOT SAVED: " + (e && e.name === "QuotaExceededError" ? "storage is full" : "storage is unavailable") + ". The ballot on screen is unchanged."); return false; }
  }

  function render() {
    els.voteList.textContent = "";
    if (!state.votes.length) els.voteList.appendChild(node("li", null, "No vote cast yet."));
    state.votes.forEach(function (v) {
      var li = node("li", null, v.voter + " \u2014 " + v.choice);
      li.appendChild(node("span", "meta", v.motion + " \u00b7 sig " + v.sig));
      els.voteList.appendChild(li);
    });

    var t = Q.tally(state.votes, state.keys);
    els.tallySays.textContent = t.says + " " + t.disclaimer;
    els.rejectList.textContent = "";
    t.rejected.forEach(function (r) {
      var li = node("li", "bad", r.reason);
      els.rejectList.appendChild(li);
    });

    els.rootText.textContent = state.votes.length ? Q.root(state.votes) : "\u2014";
    els.rootSays.textContent = state.votes.length
      ? "From " + state.votes.length + " payload(s). A second device that holds the same payloads must get this same string."
      : "Cast a vote to get a root.";

    els.qrList.textContent = "";
    state.votes.forEach(function (v) {
      var li = node("li", null, Q.toQr(v));
      els.qrList.appendChild(li);
    });
  }

  function cast() {
    var out = Q.cast({ motion: els.motion.value, voter: els.voter.value, choice: els.choice.value, key: els.key.value, at: Date.now() }, null);
    if (!out.ok) { setStatus("bad", out.reason); return; }
    state.keys[out.vote.voter] = els.key.value;
    state.votes.push(out.vote);
    var saved = persist();
    render();
    if (saved) setStatus("ok", out.says);
  }

  function check() {
    var out = Q.checkRoot(state.votes, els.claimed.value);
    setStatus(out.matches ? "ok" : "bad", out.says);
    els.rootSays.textContent = out.says;
  }

  function addPayload() {
    var out = Q.fromQr(els.qrIn.value);
    if (!out.ok) { setStatus("bad", out.reason); return; }
    state.votes.push(out.vote);
    var saved = persist();
    els.qrIn.value = "";
    render();
    if (saved) setStatus("ok", "Payload added: " + out.vote.voter + " " + out.vote.choice + ".");
  }

  function doExport() {
    var out = Q.exportFile("ballot", { votes: state.votes }, { when: today() }, function (name, text, mime) {
      if (!window.Export || typeof window.Export.save !== "function") throw new Error("the export kit did not load");
      window.Export.save(name, text, mime); return true;
    });
    if (out.ok) { els.ioNote.textContent = "Wrote " + out.filename + "."; setStatus("ok", "Exported."); }
    else setStatus("bad", out.reason + ".");
  }

  els.castBtn.addEventListener("click", cast);
  els.checkBtn.addEventListener("click", check);
  els.qrBtn.addEventListener("click", addPayload);
  els.exportBtn.addEventListener("click", doExport);

  var raw = null;
  try { raw = window.localStorage.getItem(K); } catch (e) { raw = null; }
  if (raw) {
    var parsed = Q.parseState(raw);
    if (parsed.ok) {
      state.votes = parsed.votes;
      state.votes.forEach(function (v, i) { if (!state.keys[v.voter]) state.keys[v.voter] = "k" + (i + 1); });
    } else {
      state.unreadable = parsed;
      setStatus("bad", parsed.reason);
      var keep = node("button", "small", "Export the unreadable ballot");
      keep.addEventListener("click", function () {
        var out = Q.exportFile("raw", parsed, { when: today() }, function (name, text, mime) {
          if (!window.Export || typeof window.Export.save !== "function") throw new Error("the export kit did not load");
          window.Export.save(name, text, mime); return true;
        });
        setStatus(out.ok ? "ok" : "bad", out.ok ? "Wrote " + out.filename + "." : out.reason);
      });
      els.ioNote.parentNode.insertBefore(keep, els.ioNote);
    }
  }

  render();
  if (window.Loom && window.Loom.pwa) window.Loom.pwa.register("sw.js");
})();
