/* AD30 members - God's Time Clock, antique face (member view, simple.html). Sam's pick; olive-leaf hands removed.   [clock-panel, new file]
   Web version of Ben's desktop app gtc-program/biblical_prophecy/gwc_clock.py ("Prophetic Clock").
   Needs js/gtc-core.js first (shared date math, words, settings: CLOCK_OPTIONS / SHOW_GWC_EVENTS).
   The date math lives in gtc-core.js and is checked against the desktop app:
     God's minute = 253.64833 days;  12:00 = Dec 31, 2000 · 12:36 = Jan 1, 2026 · 12:42 = Mar 2, 2030
   No sign-in, no settings, no credentials here: the page itself is already behind the site's sign-in.
   Plain ES5 so it runs on older iPhones without a build step (same as the rest of the site). */
(function (root) {
  "use strict";
  var G = root.GTCCore;
  if (!G || !root.document) return;
  var CONFIG = { FACE_SRC: "img/clock-face.webp", HUB_SRC: "img/clock-hub.webp" };
  var C = G.CONFIG;
  var pad = G.pad, dateFor = G.dateFor, isoFor = G.isoFor, longDate = G.longDate, shortDate = G.shortDate, clockText = G.clockText;
  var NUMERAL = { 0: "XII", 15: "III", 30: "VI", 45: "IX" };
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }

  /* ---------------- the hands (drawn, so the painted face can stay clean) ----------------
     The face picture had its painted hands removed (img/clock-face.webp); these two hands replace them, so there is
     only ever ONE set of hands on the clock. Pivot = the brass hub at (400, 402) on an 800 x 800 face.
     Sam asked for the antique face "without the olive leaves" — both hands are clean bronze needles, no leaf/branch
     shapes. Hour = shorter pointed needle; minute = longer pointed lance; counterweights behind the hub. */
  var HANDS_SVG =
    '<svg class="gtc-hands" viewBox="0 0 800 800" aria-hidden="true" focusable="false">' +
    '<defs>' +
    '<linearGradient id="gtcBronze" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#f0d48a"/><stop offset=".42" stop-color="#b07a2e"/><stop offset="1" stop-color="#4a2f10"/></linearGradient>' +
    '<filter id="gtcShadow" x="-30%" y="-10%" width="160%" height="130%"><feDropShadow dx="3" dy="5" stdDeviation="3.5" flood-color="#2a1a08" flood-opacity=".42"/></filter>' +
    '</defs>' +
    // hour hand: short, solid bronze needle (pointed tip + counterweight). No fleur, no leaves, no branch.
    '<g id="gtcHour" filter="url(#gtcShadow)">' +
      '<path d="M400 478 L414 456 L410 402 L414 280 L400 175 L386 280 L390 402 L386 456 Z" fill="url(#gtcBronze)" stroke="#3d250c" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M400 188 L400 402" stroke="#f6e0a8" stroke-opacity=".5" stroke-width="2.2"/>' +
    '</g>' +
    // minute hand: longer, thinner bronze lance with a sharp tip and counterweight
    '<g id="gtcMin" filter="url(#gtcShadow)">' +
      '<path d="M400 92 L409 290 L413 402 L408 478 L400 502 L392 478 L387 402 L391 290 Z" fill="url(#gtcBronze)" stroke="#3d250c" stroke-width="2.2" stroke-linejoin="round"/>' +
      '<path d="M400 106 L400 392" stroke="#f6e0a8" stroke-opacity=".55" stroke-width="1.8"/>' +
    '</g>' +
    '<circle id="gtcNowDot" class="gtc-nowdot" r="13" cx="400" cy="56"/>' +
    '</svg>';

  /* ---------------- the panel ---------------- */
  function mount(panel) {
    if (!panel || panel.getAttribute("data-gtc")) return;
    panel.setAttribute("data-gtc", "1");
    panel.classList.add("gtc");

    var nowClock = G.today();
    var state = { hour: 12, minute: nowClock.inRange ? nowClock.minute : 36, showAll: false, events: null };

    // header: on phones this is the tap-to-open bar; on wide screens it is just the title
    var head = el("button", "gtc-head"); head.type = "button";
    head.setAttribute("aria-expanded", "false"); head.setAttribute("aria-controls", "gtcBody");
    var cap = G.caption("antique");
    if (cap) head.appendChild(el("span", "gtc-cap", cap));
    var ht = el("span", "gtc-htitle serif", "God\u2019s Time Clock");
    var hs = el("span", "gtc-hspec", "speculation");
    var hn = el("span", "gtc-hnow");
    if (nowClock.inRange) {
      hn.innerHTML = '<span class="gtc-dotkey" aria-hidden="true"></span> <span class="gtc-hnowl">Now </span>' + clockText(12, nowClock.minute);
      hn.setAttribute("aria-label", "Right now " + clockText(12, nowClock.minute));
    }
    var chev = el("span", "gtc-chev"); chev.setAttribute("aria-hidden", "true");
    var hrow = el("span", "gtc-hrow");
    hrow.appendChild(ht); hrow.appendChild(hs); hrow.appendChild(hn); hrow.appendChild(chev);
    head.appendChild(hrow);
    panel.appendChild(head);

    var body = el("div", "gtc-body"); body.id = "gtcBody";
    panel.appendChild(body);

    var spec = el("p", "gtc-spec");
    spec.innerHTML = G.SPEC_HTML;
    spec.title = G.KJV_MT_24_36 + " (Matthew 24:36, KJV)";
    body.appendChild(spec);

    // the face
    var face = el("div", "gtc-face");
    face.setAttribute("role", "img");
    var img = el("img", "gtc-faceimg"); img.src = CONFIG.FACE_SRC; img.alt = ""; img.width = 680; img.height = 680; img.decoding = "async";
    face.appendChild(img);
    face.insertAdjacentHTML("beforeend", HANDS_SVG);
    var hub = el("img", "gtc-hub"); hub.src = CONFIG.HUB_SRC; hub.alt = ""; hub.width = 52; hub.height = 52;
    face.appendChild(hub);
    body.appendChild(face);
    var faceHint = el("p", "gtc-hint", "Tap the clock, or pick a time:");
    body.appendChild(faceHint);

    // the pickers (readable before anything is picked: they always show a real time)
    var pick = el("div", "gtc-pick");
    var hSel = el("select", "gtc-sel gtc-selh"); hSel.setAttribute("aria-label", "Hour");
    C.HOURS.forEach(function (h2) { var o = el("option", "", String(h2)); o.value = h2; hSel.appendChild(o); });
    if (C.HOURS.length < 2) hSel.title = "The study model runs from 12:00 to 12:59";
    var colon = el("span", "gtc-colon", ":"); colon.setAttribute("aria-hidden", "true");
    var mSel = el("select", "gtc-sel gtc-selm"); mSel.setAttribute("aria-label", "Minute");
    for (var mm = 0; mm < 60; mm++) { var o2 = el("option", "", pad(mm)); o2.value = mm; mSel.appendChild(o2); }
    pick.appendChild(hSel); pick.appendChild(colon); pick.appendChild(mSel);
    body.appendChild(pick);

    var dateP = el("p", "gtc-date"); dateP.setAttribute("aria-live", "polite");
    body.appendChild(dateP);

    var nowP = G.rightNow("gtc-now", nowClock, function (m) { setTime(m); });
    body.appendChild(nowP);

    // events (only when switched on)
    var evBox = null;
    if (C.SHOW_GWC_EVENTS) {
      evBox = el("section", "gtc-ev"); evBox.setAttribute("aria-label", "What happened at this time");
      body.appendChild(evBox);
    }

    // timeline
    var tl = el("section", "gtc-tl");
    var tlh = el("h3", "gtc-h", "Timeline");
    var tls = el("p", "gtc-sub", "Each clock minute \u2192 the date it lands on");
    var tlList = el("ol", "gtc-tlist");
    var tlMore = el("button", "gtc-link gtc-more", "Show all 60 minutes"); tlMore.type = "button";
    tl.appendChild(tlh); tl.appendChild(tls); tl.appendChild(tlList); tl.appendChild(tlMore);
    body.appendChild(tl);

    // teaching
    var teach = el("details", "gtc-teach");
    teach.innerHTML = '<summary>Teaching: where the 253.65 days come from</summary>' + G.TEACH_HTML;
    body.appendChild(teach);

    var tune = el("p", "gtc-tune", G.TUNE_TEXT);
    body.appendChild(tune);

    /* ----- behaviour ----- */
    var hourG = face.querySelector("#gtcHour"), minG = face.querySelector("#gtcMin"), nowDot = face.querySelector("#gtcNowDot");
    var shown = { min: null, hour: null }, anim = null;
    function placeNowDot() {
      if (!nowClock.inRange) { nowDot.style.display = "none"; return; }
      var a = (nowClock.minutes * 6 - 90) * Math.PI / 180, r = 344;
      nowDot.setAttribute("cx", (400 + r * Math.cos(a)).toFixed(1));
      nowDot.setAttribute("cy", (402 + r * Math.sin(a)).toFixed(1));
    }
    function drawHands(minA, hourA) {
      minG.setAttribute("transform", "rotate(" + minA.toFixed(2) + " 400 402)");
      hourG.setAttribute("transform", "rotate(" + hourA.toFixed(2) + " 400 402)");
    }
    function turnHands() {
      var targetMin = state.minute * 6, targetHour = (state.hour % 12) * 30 + state.minute * 0.5;
      if (shown.min === null) { shown.min = targetMin; shown.hour = targetHour; drawHands(targetMin, targetHour); return; }
      var d = targetMin - (shown.min % 360 + 360) % 360;                 // shortest way round
      if (d > 180) d -= 360; if (d < -180) d += 360;
      var fromM = shown.min, toM = shown.min + d, fromH = shown.hour, toH = targetHour;
      shown.min = toM; shown.hour = toH;
      var reduce = root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (anim) root.cancelAnimationFrame(anim);
      if (reduce || !root.requestAnimationFrame) { drawHands(toM, toH); return; }
      var t0 = null, dur = 320;
      anim = root.requestAnimationFrame(function step(t) {
        if (t0 === null) t0 = t;
        var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        drawHands(fromM + (toM - fromM) * e, fromH + (toH - fromH) * e);
        if (k < 1) anim = root.requestAnimationFrame(step); else anim = null;
      });
    }
    function renderDate() {
      var dt = dateFor(state.hour, state.minute, 0), iso = isoFor(state.hour, state.minute, 0);
      dateP.innerHTML = "";
      dateP.appendChild(el("span", "gtc-dlabel", "That\u2019s this date:"));
      var b = el("b", "gtc-dval", longDate(dt)); dateP.appendChild(b);
      var sm = el("span", "gtc-dtime", clockText(state.hour, state.minute) + " \u2192 " + iso);
      sm.title = "Exact point in the model (same as the desktop app)";
      dateP.appendChild(sm);
    }
    function renderTimeline() {
      tlList.innerHTML = "";
      var mins = [];
      if (state.showAll) { for (var i = 0; i < 60; i++) mins.push(i); }
      else {
        mins = C.KEY_MINUTES.slice();
        if (nowClock.inRange && mins.indexOf(nowClock.minute) < 0) mins.push(nowClock.minute);
        if (mins.indexOf(state.minute) < 0) mins.push(state.minute);
        mins.sort(function (a, b) { return a - b; });
      }
      mins.forEach(function (m) {
        var li = el("li");
        var btn = el("button", "gtc-row"); btn.type = "button";
        if (m === state.minute) { btn.classList.add("sel"); btn.setAttribute("aria-current", "true"); }
        if (nowClock.inRange && m === nowClock.minute) btn.classList.add("now");
        btn.appendChild(el("span", "gtc-rt", clockText(12, m)));
        btn.appendChild(el("span", "gtc-rd", shortDate(dateFor(12, m, 0))));
        var tag = (nowClock.inRange && m === nowClock.minute) ? "now" : (NUMERAL[m] || "");
        btn.appendChild(el("span", "gtc-rn", tag));
        btn.addEventListener("click", function () { setTime(m); });
        li.appendChild(btn); tlList.appendChild(li);
      });
      tlMore.textContent = state.showAll ? "Show fewer" : "Show all 60 minutes";
      tlMore.setAttribute("aria-expanded", state.showAll ? "true" : "false");
    }
    function renderEvents() {
      if (!evBox) return;
      evBox.innerHTML = "";
      evBox.appendChild(el("h3", "gtc-h", "What happened at " + clockText(12, state.minute)));
      var note = el("p", "gtc-sub", "From the Great World Clock list (its own clock times; its 12:00 = Jan 1, 2001). Internal review only.");
      evBox.appendChild(note);
      if (state.events === null) { evBox.appendChild(el("p", "gtc-evnone", "Loading\u2026")); return; }
      if (state.events === false) { evBox.appendChild(el("p", "gtc-evnone", "Couldn\u2019t load the list.")); return; }
      var list = G.eventsFor(state.events, state.minute);
      if (!list.length) { evBox.appendChild(el("p", "gtc-evnone", "Nothing listed for " + clockText(12, state.minute) + ".")); return; }
      var ul = el("ul", "gtc-evlist");
      list.forEach(function (e) {
        var li = el("li", "gtc-evi");
        li.appendChild(el("b", "gtc-evt", e.title));
        li.appendChild(el("span", "gtc-evd", e.date + " \u00b7 " + e.gwcTime));
        if (e.description) li.appendChild(el("p", "gtc-evp", e.description));
        if (e.sources && e.sources.length) li.appendChild(G.sourceLinks(e.sources, "gtc-evs"));
        ul.appendChild(li);
      });
      evBox.appendChild(ul);
    }
    function countLabels() {     // like the desktop dropdown "12:20 (3)", only while events are switched on
      if (!state.events) return;
      var c = {}; state.events.forEach(function (e) { c[e.minute] = (c[e.minute] || 0) + 1; });
      for (var i = 0; i < mSel.options.length; i++) mSel.options[i].textContent = pad(i) + (c[i] ? "  (" + c[i] + ")" : "");
    }
    function setTime(minute) {
      state.minute = ((minute % 60) + 60) % 60;
      mSel.value = String(state.minute); hSel.value = String(state.hour);
      turnHands(); renderDate(); renderTimeline(); renderEvents();
      face.setAttribute("aria-label", "Clock showing " + clockText(state.hour, state.minute) + ". Tap the face to pick a minute.");
    }

    mSel.addEventListener("change", function () { setTime(parseInt(mSel.value, 10)); });
    hSel.addEventListener("change", function () { state.hour = parseInt(hSel.value, 10); setTime(state.minute); });
    tlMore.addEventListener("click", function () { state.showAll = !state.showAll; renderTimeline(); });
    face.addEventListener("click", function (ev) {
      var r = face.getBoundingClientRect();
      var x = (ev.clientX - r.left) / r.width * 800 - 400, y = (ev.clientY - r.top) / r.height * 800 - 402;
      if (Math.sqrt(x * x + y * y) > 400) return;
      var deg = Math.atan2(y, x) * 180 / Math.PI + 90; if (deg < 0) deg += 360;
      setTime(Math.round(deg / 6) % 60);       // nearest minute mark (the desktop app also set seconds = minute: a bug)
    });

    // phones: collapsed by default; wide screens: always open
    var wide = G.wideQuery;
    function syncWide() {
      var w = wide.matches;
      panel.classList.toggle("gtc-wide", w);
      head.setAttribute("aria-expanded", (w || panel.classList.contains("open")) ? "true" : "false");
      if (w) head.setAttribute("tabindex", "-1"); else head.removeAttribute("tabindex");
    }
    head.addEventListener("click", function () {
      if (wide.matches) return;
      var open = !panel.classList.contains("open");
      panel.classList.toggle("open", open);
      head.setAttribute("aria-expanded", open ? "true" : "false");
    });
    G.onWideChange(syncWide);
    syncWide();

    placeNowDot();
    setTime(state.minute);

    var evP = G.loadEvents();
    if (evP) evP.then(function (list) { state.events = list; countLabels(); renderEvents(); },
                      function () { state.events = false; renderEvents(); });
  }

  function start() {
    if (!G.enabled("antique")) { G.dropPanel("gtcPanel"); return; }
    var panel = document.getElementById("gtcPanel");
    if (!panel) return;
    mount(panel);
    G.register("antique");
    G.watchPage(panel);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})(window);
