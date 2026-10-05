/* AD30 members - God's Time Clock, OPTION B: modern design from Ben's Cursor iPhone mockup.   [clock-panel, new file]
   (gtc-program/cursor/assets/iphone_prophetic_clock_main.png): charcoal face with white ticks and no numerals,
   teal hour/minute hands, coral hand + coral centre dot, a scroll-wheel time picker, a big green button,
   teal "That's this date: YYYY-MM-DD", and a teal card list for events.
   The events shown in the mockup (Whitney Houston, Grammys, ...) are placeholder art and are NOT used here;
   the only events this panel can show are the Great World Clock list, behind SHOW_GWC_EVENTS (off).
   Needs js/gtc-core.js first: same date math as Option A (one shared module), same words and settings.
   Here the coral hand points at RIGHT NOW (today on God's clock); the teal hands show the picked time.
   Plain ES5 (older iPhones, no build step). */
(function (root) {
  "use strict";
  var G = root.GTCCore;
  if (!G || !root.document) return;
  var C = G.CONFIG, pad = G.pad, clockText = G.clockText;
  var ROW = 40;                 // wheel row height (px) - keep in step with css/prophetic-clock-modern.css
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function isoDay(h, m) { return G.isoFor(h, m, 0).slice(0, 10); }

  function faceSVG() {
    var ticks = "";
    for (var i = 0; i < 12; i++) {
      var a = i * 30 * Math.PI / 180, r1 = (i % 3 === 0) ? 70 : 73, r2 = 84;
      ticks += '<line x1="' + (100 + r1 * Math.sin(a)).toFixed(2) + '" y1="' + (100 - r1 * Math.cos(a)).toFixed(2) +
        '" x2="' + (100 + r2 * Math.sin(a)).toFixed(2) + '" y2="' + (100 - r2 * Math.cos(a)).toFixed(2) + '"/>';
    }
    return '<svg class="gtm-svg" viewBox="0 0 200 200" aria-hidden="true" focusable="false">' +
      '<defs><radialGradient id="gtmFaceG" cx="50%" cy="42%" r="62%"><stop offset="0" stop-color="#3a3e43"/><stop offset=".7" stop-color="#2a2d31"/><stop offset="1" stop-color="#1f2125"/></radialGradient></defs>' +
      '<circle cx="100" cy="100" r="96" fill="#191b1e"/>' +
      '<circle cx="100" cy="100" r="92" fill="url(#gtmFaceG)" stroke="#43484e" stroke-width="1.2"/>' +
      '<g class="gtm-ticks" stroke="#e9ecef" stroke-width="4.2" stroke-linecap="round">' + ticks + '</g>' +
      '<line class="gtm-hh" id="gtmHour" x1="100" y1="106" x2="100" y2="52" stroke="#2fbf9f" stroke-width="6.5" stroke-linecap="round"/>' +
      '<line class="gtm-mh" id="gtmMin" x1="100" y1="108" x2="100" y2="26" stroke="#3fd0b0" stroke-width="4.5" stroke-linecap="round"/>' +
      '<line class="gtm-sh" id="gtmNow" x1="100" y1="116" x2="100" y2="22" stroke="#f2725f" stroke-width="2.4" stroke-linecap="round"/>' +
      '<circle cx="100" cy="100" r="5.5" fill="#f2725f"/><circle cx="100" cy="100" r="2" fill="#7a2f24"/>' +
      '</svg>';
  }

  function mount(panel) {
    if (!panel || panel.getAttribute("data-gtm")) return;
    panel.setAttribute("data-gtm", "1");
    panel.classList.add("gtm");
    var nowClock = G.today();
    var state = { hour: 12, minute: nowClock.inRange ? nowClock.minute : 36, showAll: false, events: null };

    // header bar (phones) / title (wide)
    var head = el("button", "gtm-head"); head.type = "button";
    head.setAttribute("aria-expanded", "false"); head.setAttribute("aria-controls", "gtmBody");
    var cap = G.caption("modern"); if (cap) head.appendChild(el("span", "gtc-cap gtm-cap", cap));
    var hrow = el("span", "gtm-hrow");
    hrow.appendChild(el("span", "gtm-htitle", "God\u2019s Time Clock"));
    hrow.appendChild(el("span", "gtm-hspec", "speculation"));
    var hn = el("span", "gtm-hnow");
    if (nowClock.inRange) { hn.innerHTML = '<i aria-hidden="true"></i><span class="gtm-hnowl">Now </span>' + clockText(12, nowClock.minute); hn.setAttribute("aria-label", "Right now " + clockText(12, nowClock.minute)); }
    hrow.appendChild(hn);
    var chev = el("span", "gtm-chev"); chev.setAttribute("aria-hidden", "true"); hrow.appendChild(chev);
    head.appendChild(hrow);
    panel.appendChild(head);

    var body = el("div", "gtm-body"); body.id = "gtmBody"; panel.appendChild(body);
    var spec = el("p", "gtm-spec"); spec.innerHTML = G.SPEC_HTML; spec.title = G.KJV_MT_24_36 + " (Matthew 24:36, KJV)"; body.appendChild(spec);
    body.appendChild(el("h3", "gtm-pickh", "Pick a time"));

    var face = el("div", "gtm-face"); face.setAttribute("role", "img"); face.innerHTML = faceSVG(); body.appendChild(face);
    var legend = el("p", "gtm-legend");
    legend.innerHTML = '<span class="gtm-k gtm-kt"></span> picked time' + (nowClock.inRange ? ' \u00b7 <span class="gtm-k gtm-kc"></span> right now' : '');
    body.appendChild(legend);

    // scroll-wheel picker: hour (12 only, like the desktop app) : minute (scrolls, snaps)
    var wheel = el("div", "gtm-wheel");
    var band = el("div", "gtm-band"); band.setAttribute("aria-hidden", "true"); wheel.appendChild(band);
    var hcol = el("div", "gtm-hcol", "12"); hcol.setAttribute("aria-hidden", "true"); hcol.title = "The study model runs from 12:00 to 12:59";
    var wcolon = el("div", "gtm-wcolon", ":"); wcolon.setAttribute("aria-hidden", "true");
    var mcol = el("div", "gtm-mcol"); mcol.setAttribute("role", "listbox"); mcol.tabIndex = 0;
    mcol.setAttribute("aria-label", "Minute (hour 12)");
    mcol.appendChild(el("div", "gtm-pad"));
    var opts = [];
    for (var i = 0; i < 60; i++) {
      var o = el("div", "gtm-opt", pad(i)); o.id = "gtmM" + pad(i); o.setAttribute("role", "option"); o.setAttribute("data-m", String(i));
      mcol.appendChild(o); opts.push(o);
    }
    mcol.appendChild(el("div", "gtm-pad"));
    wheel.appendChild(hcol); wheel.appendChild(wcolon); wheel.appendChild(mcol);
    body.appendChild(wheel);

    var go = el("button", "gtm-go", C.SHOW_GWC_EVENTS ? "See what happened" : "See the date"); go.type = "button";
    body.appendChild(go);
    var dateP = el("p", "gtm-date"); dateP.setAttribute("aria-live", "polite"); body.appendChild(dateP);
    body.appendChild(G.rightNow("gtm-now", nowClock, function (m) { setTime(m, true); }));

    var evCard = null;
    if (C.SHOW_GWC_EVENTS) { evCard = el("section", "gtm-ev"); evCard.setAttribute("aria-label", "What happened at this time"); body.appendChild(evCard); }

    var tl = el("section", "gtm-tl");
    tl.appendChild(el("h3", "gtm-h", "Timeline"));
    var tlList = el("ol", "gtm-tlist"); tl.appendChild(tlList);
    var tlMore = el("button", "gtc-link gtm-more", "Show all 60 minutes"); tlMore.type = "button"; tl.appendChild(tlMore);
    body.appendChild(tl);
    var teach = el("details", "gtm-teach"); teach.innerHTML = '<summary>Teaching: where the 253.65 days come from</summary>' + G.TEACH_HTML; body.appendChild(teach);
    body.appendChild(el("p", "gtm-tune", G.TUNE_TEXT));

    /* ----- behaviour ----- */
    var hourL = face.querySelector("#gtmHour"), minL = face.querySelector("#gtmMin"), nowL = face.querySelector("#gtmNow");
    function rot(node, deg) { node.setAttribute("transform", "rotate(" + deg.toFixed(2) + " 100 100)"); }
    if (nowClock.inRange) rot(nowL, nowClock.minutes * 6); else nowL.style.display = "none";
    var shown = null, anim = null;
    function turnHands() {
      var target = state.minute * 6;
      if (shown === null) { shown = target; rot(minL, target); rot(hourL, target / 12); return; }
      var d = target - ((shown % 360) + 360) % 360; if (d > 180) d -= 360; if (d < -180) d += 360;
      var from = shown, to = shown + d; shown = to;
      var reduce = root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (anim) root.cancelAnimationFrame(anim);
      if (reduce || !root.requestAnimationFrame) { rot(minL, to); rot(hourL, ((to % 360) + 360) % 360 / 12); return; }
      var t0 = null;
      anim = root.requestAnimationFrame(function step(t) {
        if (t0 === null) t0 = t;
        var k = Math.min(1, (t - t0) / 300), e = 1 - Math.pow(1 - k, 3), a = from + (to - from) * e;
        rot(minL, a); rot(hourL, ((a % 360) + 360) % 360 / 12);
        if (k < 1) anim = root.requestAnimationFrame(step); else anim = null;
      });
    }

    // wheel
    var programmatic = null, settle = null, lastHi = -1;
    function highlight(idx) {
      if (idx === lastHi) return;
      if (lastHi >= 0) { opts[lastHi].classList.remove("sel"); opts[lastHi].setAttribute("aria-selected", "false"); }
      opts[idx].classList.add("sel"); opts[idx].setAttribute("aria-selected", "true");
      mcol.setAttribute("aria-activedescendant", opts[idx].id);
      lastHi = idx;
    }
    function wheelTo(idx, smooth) {
      if (!mcol.clientHeight) return;            // hidden (collapsed bar / signed out): synced again when shown
      var top = idx * ROW;
      var inflight = programmatic && Date.now() < programmatic.until;
      if (Math.abs(mcol.scrollTop - top) < 1) {
        if (!inflight) return;
        smooth = false;                          // an earlier animated scroll is still queued: cancel it by jumping here
      }
      programmatic = { idx: idx, until: Date.now() + 1200 };
      var reduce = root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (smooth && !reduce && "scrollBehavior" in document.documentElement.style) mcol.scrollTo({ top: top, behavior: "smooth" });
      else mcol.scrollTop = top;
    }
    mcol.addEventListener("scroll", function () {
      var idx = Math.max(0, Math.min(59, Math.round(mcol.scrollTop / ROW)));
      var ours = programmatic && Date.now() < programmatic.until;
      if (!ours) { programmatic = null; highlight(idx); }
      // When scrolling has been quiet for 130ms the wheel has stopped: whatever row is in the band is the pick.
      clearTimeout(settle);
      settle = setTimeout(function () {
        var i = Math.max(0, Math.min(59, Math.round(mcol.scrollTop / ROW)));
        programmatic = null; highlight(i);
        if (i !== state.minute) setTime(i, false);
      }, 130);
    }, { passive: true });
    // The user grabbing the wheel (mouse wheel, finger, scrollbar) always wins over an in-flight animated scroll.
    ["wheel", "touchstart", "pointerdown"].forEach(function (t) {
      mcol.addEventListener(t, function () { programmatic = null; }, { passive: true });
    });
    mcol.addEventListener("click", function (ev) {
      var t = ev.target && ev.target.getAttribute && ev.target.getAttribute("data-m");
      if (t !== null && t !== undefined && t !== "") setTime(parseInt(t, 10), true);
    });
    mcol.addEventListener("keydown", function (ev) {
      var k = ev.key, m = state.minute, n = null;
      if (k === "ArrowDown" || k === "Down") n = m + 1; else if (k === "ArrowUp" || k === "Up") n = m - 1;
      else if (k === "PageDown") n = m + 5; else if (k === "PageUp") n = m - 5; else if (k === "Home") n = 0; else if (k === "End") n = 59;
      if (n === null) return;
      ev.preventDefault(); setTime(Math.max(0, Math.min(59, n)), true);
    });
    if (root.ResizeObserver) new ResizeObserver(function () { if (mcol.clientHeight) wheelTo(state.minute, false); }).observe(mcol);

    function renderDate() {
      dateP.innerHTML = "";
      var main = el("span", "gtm-dmain"); main.appendChild(document.createTextNode("That\u2019s this date: "));
      main.appendChild(el("b", "", isoDay(state.hour, state.minute)));
      dateP.appendChild(main);
      dateP.appendChild(el("span", "gtm-dlong", G.longDate(G.dateFor(state.hour, state.minute, 0))));
      var ex = el("span", "gtm-dex", clockText(state.hour, state.minute) + " \u2192 " + G.isoFor(state.hour, state.minute, 0));
      ex.title = "Exact point in the model (same as the desktop app)"; dateP.appendChild(ex);
    }
    function renderTimeline() {
      tlList.innerHTML = "";
      var mins = [];
      if (state.showAll) { for (var j = 0; j < 60; j++) mins.push(j); }
      else {
        mins = C.KEY_MINUTES.slice();
        if (nowClock.inRange && mins.indexOf(nowClock.minute) < 0) mins.push(nowClock.minute);
        if (mins.indexOf(state.minute) < 0) mins.push(state.minute);
        mins.sort(function (a, b) { return a - b; });
      }
      mins.forEach(function (m) {
        var li = el("li"), b = el("button", "gtm-row"); b.type = "button";
        if (m === state.minute) { b.classList.add("sel"); b.setAttribute("aria-current", "true"); }
        b.appendChild(el("span", "gtm-rt", clockText(12, m)));
        b.appendChild(el("span", "gtm-ra", "\u2192"));
        b.appendChild(el("span", "gtm-rd", isoDay(12, m)));
        b.appendChild(el("span", "gtm-rn", (nowClock.inRange && m === nowClock.minute) ? "now" : ""));
        b.addEventListener("click", function () { setTime(m, true); });
        li.appendChild(b); tlList.appendChild(li);
      });
      tlMore.textContent = state.showAll ? "Show fewer" : "Show all 60 minutes";
      tlMore.setAttribute("aria-expanded", state.showAll ? "true" : "false");
    }
    function renderEvents() {
      if (!evCard) return;
      evCard.innerHTML = "";
      evCard.appendChild(el("h3", "gtm-evh", "What happened at this time"));
      evCard.appendChild(el("p", "gtm-evnote", "Great World Clock list (its own clock times; its 12:00 = Jan 1, 2001). Internal review only."));
      if (state.events === null) { evCard.appendChild(el("p", "gtm-evnone", "Loading\u2026")); return; }
      if (state.events === false) { evCard.appendChild(el("p", "gtm-evnone", "Couldn\u2019t load the list.")); return; }
      var list = G.eventsFor(state.events, state.minute);
      if (!list.length) { evCard.appendChild(el("p", "gtm-evnone", "Nothing listed for " + clockText(12, state.minute) + ".")); return; }
      var ul = el("ul", "gtm-evlist");
      list.forEach(function (e) {
        var li = el("li", "gtm-evi");
        li.appendChild(el("b", "gtm-evt", e.title));
        li.appendChild(el("span", "gtm-evd", e.date + " \u00b7 " + e.gwcTime));
        if (e.description) li.appendChild(el("p", "gtm-evp", e.description));
        if (e.sources && e.sources.length) li.appendChild(G.sourceLinks(e.sources, "gtm-evs"));
        ul.appendChild(li);
      });
      evCard.appendChild(ul);
    }
    function setTime(minute, moveWheel) {
      state.minute = ((minute % 60) + 60) % 60;
      highlight(state.minute);
      if (moveWheel) wheelTo(state.minute, true);
      turnHands(); renderDate(); renderTimeline(); renderEvents();
      face.setAttribute("aria-label", "Clock showing " + clockText(state.hour, state.minute) + ". Tap the face to pick a minute.");
    }
    face.addEventListener("click", function (ev) {
      var r = face.getBoundingClientRect();
      var x = (ev.clientX - r.left) / r.width * 200 - 100, y = (ev.clientY - r.top) / r.height * 200 - 100;
      if (Math.sqrt(x * x + y * y) > 100) return;
      var deg = Math.atan2(y, x) * 180 / Math.PI + 90; if (deg < 0) deg += 360;
      setTime(Math.round(deg / 6) % 60, true);
    });
    go.addEventListener("click", function () {
      var target = evCard || dateP;
      try { target.scrollIntoView({ behavior: "smooth", block: "nearest" }); } catch (e) { target.scrollIntoView(false); }
      dateP.classList.remove("flash"); void dateP.offsetWidth; dateP.classList.add("flash");
    });
    tlMore.addEventListener("click", function () { state.showAll = !state.showAll; renderTimeline(); });

    var wide = G.wideQuery;
    function syncWide() {
      var w = wide.matches;
      panel.classList.toggle("gtm-wide", w);
      head.setAttribute("aria-expanded", (w || panel.classList.contains("open")) ? "true" : "false");
      if (w) head.setAttribute("tabindex", "-1"); else head.removeAttribute("tabindex");
      setTimeout(function () { wheelTo(state.minute, false); }, 0);
    }
    head.addEventListener("click", function () {
      if (wide.matches) return;
      var open = !panel.classList.contains("open");
      panel.classList.toggle("open", open);
      head.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) setTimeout(function () { wheelTo(state.minute, false); }, 0);
    });
    G.onWideChange(syncWide);
    syncWide();
    setTime(state.minute, false);

    var evP = G.loadEvents();
    if (evP) evP.then(function (list) { state.events = list; renderEvents(); }, function () { state.events = false; renderEvents(); });
  }

  function start() {
    if (!G.enabled("modern")) { G.dropPanel("gtmPanel"); return; }
    var panel = document.getElementById("gtmPanel");
    if (!panel) return;
    mount(panel);
    G.register("modern");
    G.watchPage(panel);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})(window);
