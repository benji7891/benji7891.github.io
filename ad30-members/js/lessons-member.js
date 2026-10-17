/* AD30 members - video LESSONS inside the MEMBER VIEW (simple.html of the simple-rework).      [lessons-merge, new file]
   Loaded on simple.html after js/common.js + js/lessons.js and BEFORE js/simple.js. Replaces js/lessons-simple.js
   (the big-card list made for the old six-card simple view) on this page.
   What members see:
     * "Latest lessons" at the top of the list (#lxSimple): newest first, NEW badge for 7 days. A lesson placed on a
       timeline marker says which section it is in and opens that section; a General lesson opens right there.
     * inside an opened section: every lesson whose timeline marker belongs to that section - the video (tap the
       picture to play), the leader's summary under a LESSON SUMMARY label, and the exact KJV verses under TEXT.
     * Study notes for a section also list its lessons (title, summary, KJV verses).
   It plugs into js/simple.js through window.AD30_SIMPLE_EXT (panel / notes / afterRender / pause) and the
   AD30L.simple() / AD30L.openSimple() hooks simple.js already calls. Same safety rules as js/lessons.js:
   leader text is always escaped, Scripture comes only from kjv/NN.json, any failure = nothing shown. */
(function () {
  "use strict";
  var AD30 = window.AD30, L = window.AD30L;
  if (!AD30 || !L) return;
  var esc = AD30.esc, $ = function (id) { return document.getElementById(id); };
  var RM = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  var ROWS = null;              // published lessons, newest first (null = not loaded yet)
  var LATEST_SHOWN = 4;         // rows shown in "Latest lessons" before "Show all"

  /* ---------- timeline marker -> member-view section ----------
     1. the section's own timelineIds in js/simple-data.js (birth; jordan; jn737 tab29 half jn714 jn82; cross jn131 jn1828 jn1942;
        three jn201 jn2019 high; pent asc)
     2. the other markers, by hand (chronological: each goes to the section it leads up to or belongs with):         */
  var EXTRA = {
    herod: "birth",                                                         // Before the ministry
    pilate: "jordan", john30: "jordan", jn1: "jordan",                      // Two men turn thirty · AD 26
    pass27: "jordan", jn435: "jordan", jn51: "jordan", pass28: "jordan",    // First Passover ... (early ministry, after the Jordan)
    pass29: "tabernacles", bday33: "tabernacles", ded29: "tabernacles", fig: "tabernacles",   // The final twelve months begin · AD 29
    jn1155: "passover", jn121: "passover", entry: "passover", n10: "passover",                // The final week, up to the cross
    jn2026: "resurrection"                                                  // Thomas, "after eight days": an appearance of the risen Lord (John 20)
  };
  //  3. a marker added to the timeline later: by its timeline group heading
  var GROUPS = [["Before the ministry", "birth"], ["Two men turn thirty", "jordan"], ["First Passover", "jordan"],
    ["The final twelve months", "tabernacles"], ["The final week", "passover"], ["Forty days", "pentecost"]];
  //  4. anything else (no marker, unknown marker) = a General lesson: shown only in "Latest lessons".
  function sections() { try { return (window.__simple && window.__simple.sections()) || []; } catch (e) { return []; } }
  function secIndex(id) { var S = sections(); for (var i = 0; i < S.length; i++) if (S[i].id === id && !S[i].extra) return i; return -1; }
  L.sectionFor = function (markerId) {
    if (!L.validMarker(markerId)) return null;
    var S = sections(), i, m;
    for (i = 0; i < S.length; i++) if (!S[i].extra && (S[i].timelineIds || []).indexOf(markerId) >= 0) return S[i].id;
    if (EXTRA[markerId] && secIndex(EXTRA[markerId]) >= 0) return EXTRA[markerId];
    m = L.marker(markerId);
    if (m) for (i = 0; i < GROUPS.length; i++) if (String(m.sec).indexOf(GROUPS[i][0]) === 0 && secIndex(GROUPS[i][1]) >= 0) return GROUPS[i][1];
    return null;
  };
  L.MEMBER_MAP = EXTRA;
  L.memberLessons = function () { return ROWS || []; };
  L.memberRow = function (id) { return rowById(id); };
  /* [featured-30th] "Start here" (#lxFeat): the newest lesson whose title contains one of these words (any case, spaces
     and punctuation ignored). Change it in js/config.js:  FEATURED_LESSON: ["30th year", "thirtieth"]  (a word or a list);
     FEATURED_LESSON: "" turns the box off. No match = nothing shown, the page is as before. */
  function compact(t) { return String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, ""); }
  L.featTerms = function () {
    var c = window.AD30_CONFIG ? window.AD30_CONFIG.FEATURED_LESSON : undefined;
    if (c === undefined || c === null) c = ["30th year", "thirtieth"];
    return [].concat(c).map(compact).filter(function (t) { return t.length >= 3; });
  };
  L.featHas = function (text) { var x = compact(text); return !!x && L.featTerms().some(function (t) { return x.indexOf(t) >= 0; }); };
  L.featured = function () { var hit = null; (ROWS || []).forEach(function (r) { if (!hit && L.featHas(r.title)) hit = r; }); return hit; };   // [studynote-fix] read by js/resources.js (which file belongs to which lesson)
  function byOrder(a, b) {
    var x = a.sort_order == null ? 1e9 : a.sort_order, y = b.sort_order == null ? 1e9 : b.sort_order;
    return x - y || String(a.created_at).localeCompare(String(b.created_at));
  }
  function lessonsFor(secId) { return (ROWS || []).filter(function (r) { return L.sectionFor(r.marker_id) === secId; }).sort(byOrder); }
  function rowById(id) { var hit = null; (ROWS || []).forEach(function (r) { if (L.vkey(r) === id) hit = r; }); return hit; }
  function secTitle(id) { var i = secIndex(id); return i >= 0 ? sections()[i].title : ""; }

  /* ---------- KJV verses (exact, from kjv/NN.json via AD30L.resolveRefs), cached per reference text ---------- */
  var refCache = {};
  function resolve(refs) {
    if (!refCache[refs]) { var c = refCache[refs] = { list: null }; c.p = L.resolveRefs(refs).then(function (list) { c.list = list; return list; }); }
    return refCache[refs];
  }
  function versesHTML(list, notes) {
    var anyOk = list.some(function (r) { return r.ok; }), h = "";
    if (anyOk) h += (notes ? '<h4 class="sx-sh lxn-sh">' : '<h4 class="sx-sh lxm-sh">') + '<span class="sx-tag">TEXT</span> What Scripture says (KJV)</h4>';
    list.forEach(function (r) {
      if (!r.ok) { h += '<p class="' + (notes ? "lxn-ref" : "lxm-ref") + '">' + esc(r.label || r.raw) + "</p>"; return; }
      var multi = r.verses.length > 1, q = r.verses.map(function (x, i) {
        return (multi ? '<sup class="lx-vn">' + (x.v === 1 && i ? x.c + ":" : "") + x.v + "</sup>" : "") + esc(x.t);
      }).join(" ");
      h += '<blockquote class="' + (notes ? "lxn-v" : "sx-v lxm-v") + ' serif"><p>“' + q + "”</p><cite>" + esc(r.label) + " (KJV)</cite></blockquote>";
    });
    return h;
  }
  function fillVerses(box) {
    if (!box || box._lxDone) return; box._lxDone = true;
    var notes = box.classList.contains("lxn-verses"), c = resolve(box.getAttribute("data-refs"));
    var put = function (list) { box.innerHTML = versesHTML(list, notes); box.classList.add("lx-filled"); };
    if (c.list) put(c.list); else c.p.then(put);
  }
  function versesBox(refs, notes) {
    if (!refs) return "";
    var c = resolve(refs), cls = notes ? "lxn-verses" : "lxm-verses";
    if (c.list) return '<div class="' + cls + ' lx-filled">' + versesHTML(c.list, notes) + "</div>";
    return '<div class="' + cls + '" data-refs="' + esc(refs) + '"><p class="' + (notes ? "lxn-ref" : "lxm-ref") + '">' + esc(refs) + "</p></div>";
  }

  /* ---------- one lesson (in a section, or a General one in "Latest lessons") ---------- */
  // Members see only the date added: the timeline marker's own title/date are Teacher-view wording (some carry
  // placement notes), and the lesson already sits inside its section.
  function whereLine(row) { return "Added " + L.dateLabel(row.created_at); }
  function lessonBlock(row, prefix, feat) {
    var id = L.vkey(row), el = document.createElement("article");
    el.className = "lxm-l"; el.id = prefix + id; el.setAttribute("data-lx", id);
    var sum = L.summaryHTML(row.summary);
    el.innerHTML =
      '<p class="lxm-kick">Video lesson' + (L.isNew(row) ? ' <span class="lx-new">NEW</span>' : "") + "</p>" +
      '<h3 class="lxm-t serif">' + esc(row.title) + "</h3>" +
      '<p class="lxm-d">' + esc(whereLine(row)) + "</p>" +
      '<div class="lx-media lxm-media"><button type="button" class="lx-thumb" aria-label="Play video: ' + esc(row.title) + '">' +
        '<img alt="" loading="lazy" decoding="async"' + L.thumbAttrs(row) + '><span class="lx-play" aria-hidden="true"></span></button></div>' +
      (sum ? '<div class="lxm-sum"><p class="lxm-lab"><span class="lxm-tag">LESSON SUMMARY</span> <span class="lxm-labt">from the Admin — teaching, not Scripture</span></p><div class="lx-text">' + sum + "</div></div>" : "") +
      versesBox(row.verse_refs, false) +
      // [studynote-fix] the lesson's own study guide (PDF / Drive link) goes right here, filled by js/resources.js
      '<div class="lxm-guide" hidden data-lxg-m="' + esc(row.marker_id || "") + '" data-lxg-t="' + esc(row.title) + '" data-lxg-c="' + esc(row.created_at || "") + '"' + (feat ? ' data-lxg-f="1"' : "") + '></div>';
    el.querySelector(".lx-thumb").addEventListener("click", function () {
      L.player(el.querySelector(".lxm-media"), row);
      AD30.track("card_open", { marker_id: row.marker_id || "lessons", video_id: id, video_title: String(row.title).slice(0, 200) });
    });
    fillVerses(el.querySelector(".lxm-verses[data-refs]"));
    if (R() && R().guides) try { R().guides(el); } catch (e) {}   // [studynote-fix]
    return el;
  }
  /* [timeline-v3] An opened section lists EVERY timeline spot that belongs to it (the same spots, titles and dates as the
     Admins' "Timeline spot" menu), grouped under the menu's category headings, in timeline order. Each spot shows its
     lessons (video + summary + verses + its own Study notes) and any other file placed there; a spot with nothing yet
     says "No lesson yet" in light text, so the whole timeline is visible. */
  function spotsFor(secId) { return (L.MARKERS || []).filter(function (m) { return L.sectionFor(m.id) === secId; }); }
  L.spotsFor = spotsFor;
  function sectionBox(secId) {
    var spots = spotsFor(secId), rows = lessonsFor(secId); if (!spots.length && !rows.length) return null;
    var box = document.createElement("div"); box.className = "lxm lxm-spots"; box.setAttribute("data-sec", secId);
    var n = rows.length;
    box.innerHTML = '<h3 class="lxm-h2">On the timeline <small>' + spots.length + (spots.length === 1 ? " spot" : " spots") +
      (n ? " · " + n + (n === 1 ? " lesson" : " lessons") : "") + "</small></h3>";
    var grp = null, seen = {};
    spots.forEach(function (m) {
      if (m.sec !== grp) { grp = m.sec; var g = document.createElement("h4"); g.className = "lxm-grp"; g.textContent = m.sec; box.appendChild(g); }
      var here = rows.filter(function (r) { return r.marker_id === m.id; });
      here.forEach(function (r) { seen[L.vkey(r)] = 1; });
      var sp = document.createElement("section"); sp.className = "lxm-spot" + (here.length ? "" : " lxm-spot-empty"); sp.id = "spot-" + m.id; sp.setAttribute("data-spot", m.id);
      sp.innerHTML = '<p class="lxm-sd">' + esc(L.shortDate(m.dt)) + '</p><h4 class="lxm-st serif">' + esc(m.ttl) + "</h4>" +
        (here.length ? "" : '<p class="lxm-none">No lesson yet</p>');
      here.forEach(function (r) { sp.appendChild(lessonBlock(r, "lxm-")); });
      var files = document.createElement("div"); files.className = "lxm-files"; files.hidden = true; files.setAttribute("data-spot-files", m.id);
      sp.appendChild(files);
      box.appendChild(sp);
    });
    // a lesson whose spot is not in the built-in list (shouldn't happen): still shown, at the end
    rows.forEach(function (r) { if (!seen[L.vkey(r)]) box.appendChild(lessonBlock(r, "lxm-")); });
    if (R() && R().spotFiles) try { R().spotFiles(box); } catch (e) {}
    return box;
  }
  function injectPanel(s, el) {
    if (!el || s.extra || el.querySelector(".lxm")) return;
    var box = sectionBox(s.id); if (!box) return;
    var before = el.querySelector(".rsm") || el.querySelector(".sx-notes");   // [timeline-v3] the spots go above the Section notes button
    if (before) el.insertBefore(box, before); else el.appendChild(box);
  }

  /* ---------- the list: which sections have lessons ---------- */
  function decorate() {
    if (!ROWS) return;
    sections().forEach(function (s) {
      if (s.extra) return;
      var li = $("s-" + s.id); if (!li) return;
      var rows = lessonsFor(s.id), d = li.querySelector(".sx-d"), old = li.querySelector(".lxm-cnt");
      if (old) old.parentNode.removeChild(old);
      li.classList.toggle("has-lesson", rows.length > 0);
      if (!rows.length || !d) return;
      li.classList.add("has-video");
      var sp = document.createElement("span"); sp.className = "lxm-cnt";
      sp.innerHTML = " · " + (rows.length > 1 ? rows.length + " lessons" : "lesson") + (rows.some(L.isNew) ? ' <span class="lx-new">NEW</span>' : "");
      d.appendChild(sp);
    });
  }

  /* ---------- "Latest lessons" at the top ---------- */
  function latestRow(row) {
    var id = L.vkey(row), secId = L.sectionFor(row.marker_id), li = document.createElement("li");
    li.className = "lxm-item" + (secId ? "" : " lxm-gen"); li.id = "lxs-" + id;
    li.innerHTML = '<button type="button" class="lxm-row" aria-expanded="false">' +
      '<span class="lx-thumb lxm-sthumb"><img alt="" loading="lazy" decoding="async"' + L.thumbAttrs(row) + '><span class="lx-play" aria-hidden="true"></span></span>' +
      '<span class="lxm-rt">' + (L.isNew(row) ? '<span class="lx-new">NEW</span> ' : "") + '<span class="lxm-rtt">' + esc(row.title) + "</span>" +
      '<span class="lxm-rw">' + (secId ? "In “" + esc(secTitle(secId).replace(/^[“"]|[”"]$/g, "")) + "”" : "General lesson") + " · " + esc(L.dateLabel(row.created_at)) + "</span></span></button>";
    var btn = li.querySelector(".lxm-row");
    if (secId) { btn.removeAttribute("aria-expanded"); btn.setAttribute("aria-label", row.title + " — opens " + secTitle(secId)); }
    btn.addEventListener("click", function () {
      AD30.track("card_open", { marker_id: "lesson-latest", video_id: id, video_title: String(row.title).slice(0, 200) });
      if (secId) openInSection(row, secId); else toggleGeneral(li, row);
    });
    return li;
  }
  function toggleGeneral(li, row, forceOpen) {
    var panel = li.querySelector(".lxm-gpanel"), btn = li.querySelector(".lxm-row");
    if (panel && !forceOpen) { panel.parentNode.removeChild(panel); btn.setAttribute("aria-expanded", "false"); li.classList.remove("open"); return; }
    if (!panel) { panel = document.createElement("div"); panel.className = "lxm-gpanel"; panel.appendChild(lessonBlock(row, "lxg-")); li.appendChild(panel); }
    btn.setAttribute("aria-expanded", "true"); li.classList.add("open");
    return panel;
  }
  // [layout-v2] "More lessons" (below the timeline): only General lessons (no timeline spot). Lessons with a spot
  // live inside their section, each with its own Study notes button under it.
  function renderLatest() {
    var sec = $("lxSimple"), list = $("lxList"), all = $("lxAll"); if (!sec || !list) return;
    list.innerHTML = "";
    var ft = L.featured();   // [featured-30th] the featured lesson is shown in "Start here", not again here
    var gen = (ROWS || []).filter(function (r) { return !L.sectionFor(r.marker_id) && r !== ft; });
    gen.forEach(function (row, i) { var li = latestRow(row); if (i >= LATEST_SHOWN) li.hidden = true; list.appendChild(li); });
    if (all) {
      all.hidden = gen.length <= LATEST_SHOWN;
      all.textContent = "Show all lessons (" + gen.length + ")";
      all.onclick = function () { [].forEach.call(list.children, function (li) { li.hidden = false; }); all.hidden = true; };
    }
    if (R() && R().moreFiles) try { R().moreFiles(); } catch (e) {}   // [timeline-v3] files with no lesson and no timeline spot
    moreVis();
  }
  // [timeline-v3] "More lessons" shows when it has a General lesson OR a file that isn't any lesson's Study notes
  function moreVis() {
    var sec = $("lxSimple"), list = $("lxList"), files = $("lxFiles"); if (!sec || !list) return;
    sec.hidden = !(list.children.length || (files && !files.hidden && files.children.length));
  }
  L.moreVis = moreVis;
  L.lessonsLoaded = function () { return ROWS !== null; };
  // [featured-30th] "Start here" box at the top: the featured lesson, open (video + summary + verses + Study notes)
  function renderFeatured() {
    var sec = $("lxFeat"), body = $("lxFeatBody"); if (!sec || !body) return;
    var row = L.featured();
    body.innerHTML = "";
    if (!row) { sec.hidden = true; return; }
    body.appendChild(lessonBlock(row, "lxf-", true));
    sec.hidden = false;
  }
  function flash(el) {
    if (!el) return;
    setTimeout(function () {
      el.scrollIntoView({ block: "start", behavior: RM ? "auto" : "smooth" });
      el.classList.remove("lxm-flash"); void el.offsetWidth; el.classList.add("lxm-flash");
    }, 80);
  }
  function openInSection(row, secId) {
    var k = secIndex(secId); if (k < 0 || !window.__simple) return false;
    if (window.__simple.openIdx() !== k) window.__simple.open(k, { instant: true, noScroll: true });
    var li = $("s-" + secId), inner = li && li.querySelector(".sx-in");
    if (inner) injectPanel(sections()[k], inner);
    flash($("lxm-" + L.vkey(row)));
    return true;
  }

  /* ---------- hooks used by js/simple.js ---------- */
  // [drive-resources] the leaders' PDFs / pictures / links (js/resources.js, window.AD30R.member) ride on the same hooks.
  function R() { return window.AD30R && window.AD30R.member; }
  function rnotes(s) { try { return (R() && R().notes(s)) || ""; } catch (e) { return ""; } }
  window.AD30_SIMPLE_EXT = {
    panel: function (s, el) {
      if (ROWS) injectPanel(s, el);
      if (R()) try { R().panel(s, el); } catch (e) { if (window.console) console.warn("[resources]", e); }
    },
    afterRender: function () { decorate(); if (R()) try { R().decorate(); } catch (e) {} },
    notes: function (s) { return lessonNotes(s) + rnotes(s); },
    pause: function (scope, except) {
      [].forEach.call((scope || document).querySelectorAll(".lxm-media, .lxm-gpanel .lx-media"), function (h) {
        var p = h._lxPlayer; if (p && p !== except && p.pauseVideo) try { p.pauseVideo(); } catch (e) {}
      });
      if (L.stopDrive) L.stopDrive(scope || document);   // [drive-resources] Google Drive videos: back to the picture
    }
  };
  function lessonNotes(s) {
      if (s.extra) return "";
      var rows = lessonsFor(s.id); if (!rows.length) return "";
      var h = '<section class="lxn"><h2 class="nt-th">' + (rows.length > 1 ? "Video lessons" : "Video lesson") + '</h2><p class="nt-note">From the Admins — teaching, not Scripture. Verses are KJV.</p>';
      rows.forEach(function (r) {
        var sum = L.summaryHTML(r.summary);
        h += '<div class="lxn-l"><h3 class="lxn-t">' + esc(r.title) + '</h3><p class="lxn-d">' + esc(whereLine(r)) + "</p>" +
          (sum ? '<p class="lxn-lab"><span class="lxm-tag">LESSON SUMMARY</span></p><div class="lxn-sum">' + sum + "</div>" : "") +
          versesBox(r.verse_refs, true) + "</div>";
      });
      setTimeout(function () { [].forEach.call(document.querySelectorAll(".lxn-verses[data-refs]"), fillVerses); }, 0);
      return h + "</section>";
  }

  // "Latest lessons" arrives a moment after the page shows and sits ABOVE the sections. If a section is already open
  // (e.g. simple.html#tabernacles) or the member has scrolled, keep what they are looking at in the same place on screen
  // (iPhone Safari has no scroll anchoring, so without this the open section would jump down, maybe off screen).
  function keepPlace() {
    var el = document.querySelector(".sx-item.open"), i, items;
    if (!el && (window.pageYOffset || 0) > 0) {
      items = document.querySelectorAll(".sx-item");
      for (i = 0; i < items.length && !el; i++) if (items[i].getBoundingClientRect().bottom > 0) el = items[i];
    }
    if (!el) return function () {};
    var top = el.getBoundingClientRect().top;
    return function () { var d = el.getBoundingClientRect().top - top; if (Math.abs(d) > 1) window.scrollBy(0, d); };
  }

  // AD30L.simple(): called by simple.js once the signed-in page shows. Never rejects; any failure = nothing shown.
  L.simple = function () {
    if (R()) try { R().load(); } catch (e) { if (window.console) console.warn("[resources]", e); }   // [drive-resources] in parallel
    return L.fetch().then(function (res) {
      try {
        ROWS = L.usable(res.rows);
        ROWS.forEach(function (r) { if (r.verse_refs) resolve(r.verse_refs); });   // load the KJV text now, so notes and print have it
        var anchor = keepPlace();
        renderFeatured(); renderLatest(); decorate();
        sections().forEach(function (s) { var li = $("s-" + s.id), inner = li && li.querySelector(".sx-in"); if (inner && inner.firstChild) injectPanel(s, inner); });
        anchor();
      } catch (e) { if (window.console) console.warn("[lessons]", e); }
      return res;
    });
  };
  // AD30L.openSimple(hash): #v-<video id: YouTube or Google Drive> (lesson link) or a timeline marker id simple-data doesn't know (e.g. #pass27).
  L.openSimple = function (want) {
    want = String(want || "");
    if (/^v-[A-Za-z0-9_-]{11,100}$/.test(want)) {
      var row = rowById(want.slice(2)); if (!row) return false;
      if (row === L.featured() && $("lxf-" + L.vkey(row))) { flash($("lxf-" + L.vkey(row))); return true; }   // [featured-30th]
      var secId = L.sectionFor(row.marker_id);
      if (secId) return openInSection(row, secId);
      var li = $("lxs-" + L.vkey(row)); if (!li) return false;
      li.hidden = false; toggleGeneral(li, row, true); flash(li); return true;
    }
    var s = L.sectionFor(want), k = s ? secIndex(s) : -1;
    if (k < 0 || !window.__simple) return false;
    if (window.__simple.openIdx() !== k) window.__simple.open(k, { instant: true });
    return true;
  };
})();
