/* AD30 members - "Or enter a date": place a video or PDF on the timeline by its own date.        [timeline-dates, new file]
   Database (migrations/2026-10-19_timeline_dates.sql): nullable timeline_year (BC = negative, no year 0; AD 30 = 30, 5 BC = -5),
   timeline_month (1-12), timeline_day (1-31), timeline_label (text) on public.lessons and public.resources.
   How placement works: the date is saved AND marker_id is set to the timeline spot the date belongs to
   (the spot on that day; otherwise the last spot before it; a year- or month-only date goes to the first spot in that
   year/month). So every page that already understands marker_id puts the item in the right place, and inside a spot
   items are listed in date order with their date shown. Picking a spot from the menu clears the date.
   Until the migration has been run the date fields are not shown and nothing changes (TD.ready stays false). */
(function () {
  "use strict";
  var AD30 = window.AD30, L = window.AD30L; if (!AD30 || !L) return;
  var TD = (L.TD = {}), $ = function (id) { return document.getElementById(id); }, esc = AD30.esc;
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var HEB = { nisan: 4, iyar: 5, sivan: 6, tammuz: 7, av: 8, elul: 9, tishri: 10, tishrei: 10, cheshvan: 11, kislev: 12, tevet: 1, shevat: 2, adar: 3 };
  TD.COLS = ["timeline_year", "timeline_month", "timeline_day", "timeline_label"];
  TD.ready = !!AD30.demo;

  /* ---------- dates ---------- */
  function ord(y, m, d) { return y * 10000 + (m || 0) * 100 + (d || 0); }       // BC years are negative, so order is right
  TD.of = function (r) { return r && r.timeline_year ? { y: +r.timeline_year, m: r.timeline_month ? +r.timeline_month : null, d: r.timeline_day ? +r.timeline_day : null, label: r.timeline_label || "" } : null; };
  TD.fmt = function (t) {
    if (!t || !t.y) return "";
    var yr = t.y < 0 ? -t.y + " BC" : "AD " + t.y;
    return (t.d ? t.d + " " : "") + (t.m ? MON[t.m - 1] + " " : "") + yr;
  };
  TD.text = function (r) { var t = TD.of(r); return t ? TD.fmt(t) + (t.label ? " · " + t.label : "") : ""; };
  // a spot's date from its menu text, e.g. "Mon 11 Sep 5 BC (Julian)", "AD 26 (year only)", "Early Nisan AD 30"
  function spotDate(m) {
    var s = String(m.dt || ""); if (/^\s*Undated/i.test(s)) return null;
    var y = s.match(/AD\s*(\d{1,4})|(\d{1,4})\s*BC/); if (!y) return null;
    var head = s.slice(0, y.index + y[0].length), year = y[1] ? +y[1] : -y[2], mo = null, d = null;
    var first = head.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/);
    if (first) { mo = MON.indexOf(first[2] || first[3]) + 1; d = first[1] ? +first[1] : null; }
    else { var h = head.toLowerCase().match(/\b(nisan|iyar|sivan|tammuz|av|elul|tishrei?|cheshvan|kislev|tevet|shevat|adar)\b/); if (h) mo = HEB[h[1]]; }
    return { y: year, m: mo, d: d };
  }
  var SPOTS = null;
  function spots() { if (!SPOTS) SPOTS = (L.MARKERS || []).map(function (m) { var t = spotDate(m); return t ? { m: m, t: t, o: ord(t.y, t.m, t.d) } : null; }).filter(Boolean); return SPOTS; }
  TD.spotDate = function (id) { var m = L.marker(id); return m ? spotDate(m) : null; };
  // the timeline spot a date belongs to -> { id, how: "on" | "first" | "after" | "before" }
  TD.place = function (t) {
    var S = spots(); if (!S.length || !t || !t.y) return null;
    if (!t.d) { var same = S.filter(function (s) { return s.t.y === t.y && (!t.m || s.t.m === t.m); })[0]; if (same) return { id: same.m.id, how: "first" }; }
    var o = ord(t.y, t.m, t.d), best = null;
    S.forEach(function (s) { if (s.o <= o && (!best || s.o > best.o)) best = s; });
    if (!best) return { id: S[0].m.id, how: "before" };
    return { id: best.m.id, how: best.o === o ? "on" : "after" };
  };
  // sort key inside a spot: the item's own date, or the spot's date for items without one
  TD.key = function (r) { var t = TD.of(r) || TD.spotDate(r.marker_id); return t ? ord(t.y, t.m, t.d) : 9e9; };
  TD.sort = function (list) { return list.slice().sort(function (a, b) { return TD.key(a) - TD.key(b); }); };
  TD.suffix = function (r) { var x = TD.text(r); return x ? " · 📅 " + x : ""; };
  function valid(t) {
    if (!t.y || t.y === 0 || Math.abs(t.y) > 4000) return "Please type a year like 30 (and pick AD or BC).";
    if (t.d && !t.m) return "Please pick the month too (or leave the day empty).";
    if (t.d) { var dim = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][t.m - 1]; if (t.d < 1 || t.d > dim) return "That day isn’t in " + MON[t.m - 1] + "."; }
    return "";
  }

  /* ---------- the form widget (lx = lesson form, rs = PDF form, cb = one simple form) ---------- */
  function widget(p, after) {
    if (!after || $(p + "TdBox")) return;
    var box = document.createElement("div"); box.id = p + "TdBox"; box.className = "td-box"; box.hidden = !TD.ready;
    var mo = '<option value="">Month (optional)</option>' + MON.map(function (m, i) { return '<option value="' + (i + 1) + '">' + m + "</option>"; }).join("");
    box.innerHTML = '<label class="td-tog"><input type="checkbox" id="' + p + 'TdOn"> <b>Or enter a date</b> <small>— it goes on the timeline by its date</small></label>' +
      '<div class="td-f" id="' + p + 'TdF" hidden>' +
        '<div class="td-row"><select class="field td-era" id="' + p + 'TdEra" aria-label="AD or BC"><option value="AD">AD</option><option value="BC">BC</option></select>' +
        '<input class="field td-y" id="' + p + 'TdY" type="number" inputmode="numeric" min="1" max="4000" placeholder="Year, e.g. 30" aria-label="Year"></div>' +
        '<div class="td-row"><select class="field td-m" id="' + p + 'TdM" aria-label="Month">' + mo + "</select>" +
        '<input class="field td-d" id="' + p + 'TdD" type="number" inputmode="numeric" min="1" max="31" placeholder="Day" aria-label="Day (optional)"></div>' +
        '<input class="field" id="' + p + 'TdL" maxlength="120" placeholder="Label (optional), e.g. Feast of Tabernacles" aria-label="Label (optional)">' +
        '<p class="lx-help" id="' + p + 'TdMsg" aria-live="polite">Type the year; month and day are optional.</p></div>';
    after.parentNode.insertBefore(box, after.nextSibling);
    var on = $(p + "TdOn");
    on.addEventListener("change", function () { $(p + "TdF").hidden = !on.checked; var s = $(p + "Marker"); if (s) s.disabled = on.checked; hint(p); });
    [p + "TdEra", p + "TdY", p + "TdM", p + "TdD", p + "TdL"].forEach(function (id) { $(id).addEventListener("input", function () { hint(p); }); $(id).addEventListener("change", function () { hint(p); }); });
  }
  TD.read = function (p) {
    var on = $(p + "TdOn"); if (!TD.ready || !on || !on.checked) return null;
    var y = parseInt($(p + "TdY").value, 10), t = { y: isNaN(y) ? 0 : ($(p + "TdEra").value === "BC" ? -y : y), m: parseInt($(p + "TdM").value, 10) || null, d: parseInt($(p + "TdD").value, 10) || null, label: $(p + "TdL").value.trim() };
    var e = valid(t); return e ? { error: e } : t;
  };
  function where(id) { var m = L.marker(id); return m ? L.markerLabel(m) : "More lessons"; }
  function hint(p) {
    var msg = $(p + "TdMsg"); if (!msg) return;
    var t = TD.read(p); if (!t) return;
    if (t.error) { msg.className = "lx-warn"; msg.textContent = $(p + "TdY").value ? t.error : "Type the year; month and day are optional."; if (!$(p + "TdY").value) msg.className = "lx-help"; return; }
    var pl = TD.place(t); msg.className = "lx-good";
    msg.innerHTML = "📅 " + esc(TD.fmt(t)) + " → " + (pl.how === "on" ? "on" : pl.how === "first" ? "at" : pl.how === "before" ? "before" : "right after") + " <b>" + esc(where(pl.id)) + "</b>";
  }
  // fields to save. Returns an error text, or "" (row is changed in place).
  TD.apply = function (row, p) {
    if (!TD.ready) return "";
    var t = TD.read(p);
    if (t && t.error) return t.error;
    if (!t) { TD.COLS.forEach(function (c) { row[c] = null; }); return ""; }
    TD.put(row, t); return "";
  };
  TD.put = function (row, t) {
    if (!t) { TD.COLS.forEach(function (c) { row[c] = null; }); return row; }
    var pl = TD.place(t); row.marker_id = pl ? pl.id : null;
    row.timeline_year = t.y; row.timeline_month = t.m || null; row.timeline_day = t.d || null; row.timeline_label = t.label ? t.label.slice(0, 120) : null;
    return row;
  };
  TD.fill = function (p, r) {
    var t = TD.of(r), on = $(p + "TdOn"); if (!on) return;
    on.checked = !!t; $(p + "TdF").hidden = !t; var s = $(p + "Marker"); if (s) s.disabled = !!t;
    $(p + "TdEra").value = t && t.y < 0 ? "BC" : "AD"; $(p + "TdY").value = t ? Math.abs(t.y) : ""; $(p + "TdM").value = t && t.m ? t.m : ""; $(p + "TdD").value = t && t.d ? t.d : ""; $(p + "TdL").value = t ? t.label : "";
    hint(p);
  };
  TD.clear = function (p) { TD.fill(p, null); };
  // the small date form inside "Move to…" (js/timeline-placer.js)
  TD.sheetHTML = function (row) {
    if (!TD.ready) return "";
    var t = TD.of(row);
    return '<details class="td-sheet"' + (t ? " open" : "") + '><summary><b>Or enter a date</b>' + (t ? " — now " + esc(TD.text(row)) : "") + "</summary>" +
      '<div class="td-f" id="tpTdF"><input type="checkbox" id="tpTdOn" checked hidden>' +
      '<div class="td-row"><select class="field td-era" id="tpTdEra"><option value="AD">AD</option><option value="BC">BC</option></select><input class="field td-y" id="tpTdY" type="number" inputmode="numeric" placeholder="Year, e.g. 30"></div>' +
      '<div class="td-row"><select class="field td-m" id="tpTdM"><option value="">Month (optional)</option>' + MON.map(function (m, i) { return '<option value="' + (i + 1) + '">' + m + "</option>"; }).join("") + '</select><input class="field td-d" id="tpTdD" type="number" inputmode="numeric" placeholder="Day"></div>' +
      '<input class="field" id="tpTdL" maxlength="120" placeholder="Label (optional)"><p class="lx-help" id="tpTdMsg">Type the year; month and day are optional.</p>' +
      '<button type="button" class="btn td-go" id="tpTdGo">Place by this date</button></div></details>';
  };
  TD.wireSheet = function (sheet, row, go) {
    var b = sheet.querySelector("#tpTdGo"); if (!b) return;
    var t = TD.of(row);
    if (t) { $("tpTdEra").value = t.y < 0 ? "BC" : "AD"; $("tpTdY").value = Math.abs(t.y); $("tpTdM").value = t.m || ""; $("tpTdD").value = t.d || ""; $("tpTdL").value = t.label || ""; }
    ["tpTdEra", "tpTdY", "tpTdM", "tpTdD", "tpTdL"].forEach(function (id) { $(id).addEventListener("input", function () { hint("tp"); }); $(id).addEventListener("change", function () { hint("tp"); }); });
    hint("tp");
    b.addEventListener("click", function () { var x = TD.read("tp"); if (!x || x.error) { $("tpTdMsg").className = "lx-warn"; $("tpTdMsg").textContent = (x && x.error) || "Type the year."; return; } go(x); });
  };

  /* ---------- is the database ready? (columns exist) ---------- */
  TD.check = function () {
    if (AD30.demo || !AD30.sb) return Promise.resolve(TD.ready);
    var probe = function (t) { return L.timeout(AD30.sb.from(t).select("timeline_year,timeline_month,timeline_day,timeline_label").limit(1), 9000).then(function (r) { return !r.error; }, function () { return false; }); };
    return Promise.all([probe("lessons"), probe("resources")]).then(function (a) { TD.ready = a[0] && a[1]; show(); return TD.ready; });
  };
  function show() { ["lx", "rs", "cb"].forEach(function (p) { var b = $(p + "TdBox"); if (b) b.hidden = !TD.ready; }); }
  function init() {
    widget("lx", $("lxMarker") && $("lxMarker").nextElementSibling);
    widget("rs", $("rsMarker") && $("rsMarker").nextElementSibling);
    widget("cb", $("cbMarker") && ($("cbMarker").nextElementSibling || $("cbMarker")));
    if ($("lxMarker") || $("rsMarker")) TD.check();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
