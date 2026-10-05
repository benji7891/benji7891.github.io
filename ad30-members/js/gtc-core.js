/* AD30 members - God's Time Clock: SHARED core for the clock panel on the member view.   [clock-panel, new file]
   One place for: which clock designs are on (CLOCK_OPTIONS), the date math, words/verses, "Right now",
   the events list loader, and the page layout hooks.
   Winner (Sam, Oct 2026): antique face only — js/prophetic-clock.js + css/prophetic-clock.css.
   CLOCK_OPTIONS still exists so a second design can be re-added later without rewriting the layout.
   The date math is a straight port of Ben's desktop app gtc-program/biblical_prophecy/gwc_clock.py (checked against it).
   Plain ES5 (older iPhones, no build step). */
(function (root) {
  "use strict";

  var CONFIG = {
    CLOCK_OPTIONS: ["antique"],              // Sam chose antique (Oct 2026). Was ["antique","modern"]; switch kept so a second design can be re-added later.
    // "What happened at this time" (Great World Clock data, data/gwc-events.json). OFF until Ben confirms permission.
    // While false: no events section in either panel and the JSON is never downloaded.
    SHOW_GWC_EVENTS: false,
    HOURS: [12],                              // the desktop app's clock runs 12:00-12:59 only
    KEY_MINUTES: [0, 15, 20, 30, 36, 42, 45, 59],
    EVENTS_URL: "data/gwc-events.json"
  };
  // Test-only switch for internal review: ?gtcEvents=1 - honoured ONLY on localhost / 127.0.0.1 / file:, never on the live site.
  try {
    var host = root.location && root.location.hostname;
    if (/[?&]gtcEvents=1\b/.test(root.location.search) && (host === "localhost" || host === "127.0.0.1" || root.location.protocol === "file:")) CONFIG.SHOW_GWC_EVENTS = true;
  } catch (e) {}

  /* ---------------- the math (port of gwc_clock.py) ---------------- */
  var GODS_MINUTE_DAYS = 253.64833;
  var DAY_MS = 86400000;
  // datetime(1500, 12, 26, 20, 42, 1, 728002): a "naive" date, kept as if UTC so no time zone / DST can move it
  var BASE_MS = Date.UTC(1500, 11, 26, 20, 42, 1, 728) + 0.002;
  // Same expression as GWCClockApp._update_date_display: total_minutes * G + (seconds / 60) * G
  function msFor(hour, minute, second) {
    var totalMinutes = hour * 60 + minute;
    var offsetDays = totalMinutes * GODS_MINUTE_DAYS + ((second || 0) / 60) * GODS_MINUTE_DAYS;
    return Math.round((BASE_MS + offsetDays * DAY_MS) * 1000) / 1000;   // timedelta keeps microseconds
  }
  function dateFor(hour, minute, second) { return new Date(Math.floor(msFor(hour, minute, second))); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  // "%Y-%m-%d %H:%M:%S" exactly like the desktop app (seconds truncated, as strftime does)
  function isoFor(hour, minute, second) {
    var d = new Date(Math.floor(msFor(hour, minute, second) / 1000) * 1000);
    return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate()) + " " +
      pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()) + ":" + pad(d.getUTCSeconds());
  }
  // The other way round: which clock time is a calendar date? (y, m 1-12, d, optional h/mi/s)
  function clockFor(y, m, d, hh, mi, ss) {
    var ms = Date.UTC(y, m - 1, d, hh || 0, mi || 0, ss || 0);
    var total = Math.round((ms - BASE_MS) / DAY_MS / GODS_MINUTE_DAYS * 1e9) / 1e9;   // minutes since 0:00 on God's clock
    var hour = Math.floor(total / 60), rest = total - hour * 60;
    var minute = Math.floor(rest), second = Math.floor((rest - minute) * 60);
    return { hour: hour, minute: minute, second: second, minutes: rest, inRange: hour === 12 };
  }

  /* ---------------- words & formatting ---------------- */
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  function longDate(dt) { return DAYS[dt.getUTCDay()] + ", " + MONTHS[dt.getUTCMonth()] + " " + dt.getUTCDate() + ", " + dt.getUTCFullYear(); }
  function shortDate(dt) { return MONTHS[dt.getUTCMonth()].slice(0, 3) + " " + dt.getUTCDate() + ", " + dt.getUTCFullYear(); }
  function clockText(h, m, s) { return h + ":" + pad(m) + (s === undefined ? "" : ":" + pad(s)); }
  var KJV_2PE_3_8 = "But, beloved, be not ignorant of this one thing, that one day is with the Lord as a thousand years, and a thousand years as one day.";
  var KJV_MT_24_36 = "But of that day and hour knoweth no man, no, not the angels of heaven, but my Father only.";
  var SPEC_HTML = "<b>SPECULATION</b> \u2014 a study model, not Scripture. <cite>Matthew 24:36</cite>";
  var TEACH_HTML =
    '<blockquote class="gtc-v"><p>\u201c' + KJV_2PE_3_8 + '\u201d</p><cite>2 Peter 3:8</cite></blockquote>' +
    '<p>If one day is as a thousand years, then one of the 1,440 minutes in a day is about 253.65 days. ' +
    'This model counts God\u2019s minutes on a clock: 12:00 lands on Dec 31, 2000 and 12:36 on Jan 1, 2026.</p>' +
    '<p>It is a way to think about time, not a date-setting tool.</p>' +
    '<blockquote class="gtc-v"><p>\u201c' + KJV_MT_24_36 + '\u201d</p><cite>Matthew 24:36</cite></blockquote>';
  var TUNE_TEXT = "1 God\u2019s minute = 253.64833 days \u00b7 12:00 = Dec 31, 2000 \u00b7 12:36 = Jan 1, 2026";
  var CAPTIONS = { antique: "Option A \u2014 antique face", modern: "Option B \u2014 modern (Cursor mockup)" };

  var API = {
    CONFIG: CONFIG, GODS_MINUTE_DAYS: GODS_MINUTE_DAYS, msFor: msFor, dateFor: dateFor, isoFor: isoFor, clockFor: clockFor,
    pad: pad, longDate: longDate, shortDate: shortDate, clockText: clockText,
    KJV_2PE_3_8: KJV_2PE_3_8, KJV_MT_24_36: KJV_MT_24_36, SPEC_HTML: SPEC_HTML, TEACH_HTML: TEACH_HTML, TUNE_TEXT: TUNE_TEXT
  };
  if (typeof module === "object" && module.exports) { module.exports = API; }
  if (!root.document) return;          // Node (tests): math only
  root.GTCCore = API;

  /* ---------------- shared page helpers ---------------- */
  API.enabled = function (name) { return CONFIG.CLOCK_OPTIONS.indexOf(name) >= 0; };
  // Small "Option A / Option B" caption, only while BOTH designs are on (so it disappears once Sam picks one)
  API.caption = function (name) { return CONFIG.CLOCK_OPTIONS.length > 1 ? (CAPTIONS[name] || "") : ""; };
  // Today on God's clock (local date, at the start of the day)
  API.today = function () {
    var now = new Date();
    var c = clockFor(now.getFullYear(), now.getMonth() + 1, now.getDate());
    c.dateLabel = shortDate(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
    return c;
  };
  // The same "Right now" sentence in both panels. Returns the <p>; onShow(minute) is called by its "Show" button.
  API.rightNow = function (cls, nowClock, onShow) {
    var p = document.createElement("p"); p.className = cls;
    if (!nowClock.inRange) { p.textContent = "Today is outside 12:00\u201312:59 on this clock."; return p; }
    p.innerHTML = '<span class="gtc-dotkey" aria-hidden="true"></span> Right now (' + nowClock.dateLabel + ') is about <b>' +
      clockText(12, nowClock.minute, nowClock.second) + '</b> on this clock.';
    var go = document.createElement("button"); go.type = "button"; go.className = "gtc-link"; go.textContent = "Show";
    go.addEventListener("click", function () { onShow(nowClock.minute); });
    p.appendChild(document.createTextNode(" ")); p.appendChild(go);
    return p;
  };
  // One download of the events list, shared by both panels (only ever called when SHOW_GWC_EVENTS is on)
  var evPromise = null;
  API.loadEvents = function () {
    if (!CONFIG.SHOW_GWC_EVENTS) return null;
    if (!evPromise) evPromise = fetch(CONFIG.EVENTS_URL, { cache: "no-cache", credentials: "same-origin" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (j) { return (j && j.events) || []; });
    return evPromise;
  };
  API.eventsFor = function (events, minute) { return events.filter(function (e) { return e.minute === minute; }); };
  API.sourceLinks = function (sources, cls) {
    var span = document.createElement("span"); span.className = cls;
    sources.forEach(function (u, i) {
      var a = document.createElement("a"); a.textContent = sources.length > 1 ? "source " + (i + 1) : "source";
      a.href = u; a.target = "_blank"; a.rel = "noopener noreferrer nofollow";
      span.appendChild(a); if (i < sources.length - 1) span.appendChild(document.createTextNode(" \u00b7 "));
    });
    return span;
  };
  // Show a panel only while the member page is showing (both are hidden behind the sign-in screen)
  API.watchPage = function (panel) {
    var page = document.getElementById("page");
    if (!page) { panel.hidden = false; return; }
    var sync = function () { panel.hidden = page.hidden; };
    sync();
    if (root.MutationObserver) new MutationObserver(sync).observe(page, { attributes: true, attributeFilter: ["hidden"] });
  };
  // Tell the layout how many clocks are really on (gtc-layout.css: 1 = one side column, 2 = left + right / stacked)
  var mounted = {};
  API.register = function (name) {
    mounted[name] = true;
    var shell = document.querySelector(".gtc-shell");
    if (shell) shell.setAttribute("data-gtc-count", String(Object.keys(mounted).length));
  };
  // Remove the <aside> of a design that is switched off
  API.dropPanel = function (id) { var el = document.getElementById(id); if (el && el.parentNode) el.parentNode.removeChild(el); };
  // "wide" = the panel is shown open as a column (900px+); phones get the tap-to-open bar
  API.wideQuery = root.matchMedia ? root.matchMedia("(min-width: 900px)") : { matches: true, addListener: function () {} };
  API.onWideChange = function (fn) { var q = API.wideQuery; if (q.addEventListener) q.addEventListener("change", fn); else if (q.addListener) q.addListener(fn); };
})(typeof window !== "undefined" ? window : globalThis);
