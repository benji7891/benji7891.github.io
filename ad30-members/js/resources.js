/* AD30 members - RESOURCES: the PDFs, pictures (e.g. timeline charts) and links the group leaders add.   [drive-resources, new file]
   Loaded after js/common.js + js/lessons.js on simple.html (member view), index.html (Teacher view) and admin.html.
     * Table public.resources (RLS: signed-in members with access read published rows; only admins add / delete).
     * Files live in the PRIVATE Supabase Storage bucket "resources". The page asks Supabase for signed links
       (one request for all files, valid 12 hours, renewed when the page comes back to the front after an hour) and
       puts them on ordinary links that open in a new tab - reliable in iPhone Safari (no pop-up blocking).
     * Member view: a "Resources" shelf under "Latest lessons" + each resource inside its section (same timeline
       marker -> section mapping as the lessons, AD30L.sectionFor) + titles and notes in Study notes (not the files).
     * Teacher view: a "Resources" strip under "Latest lessons" + each resource inside its timeline marker.
   Leader text (title, note) is always escaped. Any failure = nothing shown; the rest of the page is unchanged. */
(function () {
  "use strict";
  var AD30 = window.AD30, L = window.AD30L;
  if (!AD30) return;
  var esc = AD30.esc, $ = function (id) { return document.getElementById(id); };
  var R = (window.AD30R = {});
  R.BUCKET = "resources";
  R.MAX_BYTES = 45 * 1024 * 1024;           // same limit as the bucket (47185920 bytes)
  R.SIGN_SECS = 12 * 3600;                  // signed links last 12 hours ...
  R.RESIGN_MS = 60 * 60 * 1000;             // ... and are renewed when the page comes back after an hour
  R.TYPES = {
    "application/pdf": { kind: "pdf", ext: "pdf" },
    "image/png": { kind: "image", ext: "png" },
    "image/jpeg": { kind: "image", ext: "jpg" },
    "image/webp": { kind: "image", ext: "webp" }
  };
  var EXT = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };
  var COLS = "id,created_at,created_by,title,note,kind,storage_path,thumb_path,url,mime,size_bytes,marker_id,sort_order,published";
  var PATH_RE = /^[0-9]{4}\/[0-9]{2}\/[A-Za-z0-9_-]{16,64}\/[A-Za-z0-9._-]{1,120}$/;

  /* ---------- checks (also used by the admin card) ---------- */
  function extOf(name) { var m = String(name || "").toLowerCase().match(/\.([a-z0-9]{1,5})$/); return m ? m[1] : ""; }
  // file -> { kind, mime, ext } or { error: "empty" | "heic" | "type" | "size" | "zero" }
  R.checkFile = function (file) {
    if (!file) return { error: "empty" };
    var type = String(file.type || "").toLowerCase(), ext = extOf(file.name);
    if (/heic|heif/.test(type) || /^(heic|heif)$/.test(ext)) return { error: "heic" };
    var mime = R.TYPES[type] ? type : (!type || type === "application/octet-stream") && EXT[ext] ? EXT[ext] : null;
    if (!mime) return { error: "type" };
    if (EXT[ext] && EXT[ext] !== mime) return { error: "type" };            // e.g. "chart.pdf" that is really a picture
    if (!file.size) return { error: "zero" };
    if (file.size > R.MAX_BYTES) return { error: "size" };
    return { kind: R.TYPES[mime].kind, mime: mime, ext: R.TYPES[mime].ext };
  };
  // link -> { url, kind } or { error: "empty" | "notlink" | "nothttps" }
  R.checkUrl = function (input) {
    var s = String(input || "").trim(); if (!s) return { error: "empty" };
    var found = s.match(/https?:\/\/\S+/i); if (found) s = found[0];
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = "https://" + s;
    var u; try { u = new URL(s); } catch (e) { return { error: "notlink" }; }
    if (u.protocol === "http:") return { error: "nothttps" };
    if (u.protocol !== "https:" || !/\./.test(u.hostname) || /[\s<>"]/.test(u.href) || u.href.length > 1000) return { error: "notlink" };
    var p = u.pathname.toLowerCase();
    return { url: u.href, kind: /\.pdf$/.test(p) ? "pdf" : /\.(png|jpe?g|webp|gif)$/.test(p) ? "image" : "link" };
  };
  R.size = function (n) { return n >= 1048576 ? (n / 1048576).toFixed(n >= 10485760 ? 0 : 1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; };
  function host(url) { try { return new URL(url).hostname.replace(/^www\./, ""); } catch (e) { return ""; } }
  R.kindLabel = function (r) {
    if (r.storage_path) return r.kind === "pdf" ? "PDF" : "Picture";
    var h = host(r.url);
    return (r.kind === "pdf" ? "PDF link" : r.kind === "image" ? "Picture link" : "Link") + (h ? " · " + h : "");
  };
  R.openLabel = function (r) { return r.kind === "pdf" ? "Open the PDF" : r.kind === "image" && r.storage_path ? "Open full size" : r.kind === "image" ? "Open the picture" : "Open the link"; };
  R.isMissingTable = function (err) {
    var m = String((err && (err.message || err.details || err.hint)) || "") + " " + String(err && err.code || "");
    return /PGRST205|42P01|schema cache|does not exist|relation .*resources/i.test(m);
  };
  R.validMarker = function (id) { return typeof id === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(id); };
  function timeout(p, ms) {
    return new Promise(function (res, rej) { var t = setTimeout(function () { rej(new Error("timeout")); }, ms); p.then(function (v) { clearTimeout(t); res(v); }, function (e) { clearTimeout(t); rej(e); }); });
  }
  R.timeout = timeout;

  /* ---------- data ---------- */
  // opts.all = admin list (published + hidden). Resolves { rows, error, missing } - never rejects.
  R.fetch = function (opts) {
    opts = opts || {};
    if (AD30.demo || !AD30.sb) return Promise.resolve({ rows: [], error: AD30.demo ? null : "not connected" });
    var q = AD30.sb.from("resources").select(COLS);
    if (!opts.all) q = q.eq("published", true);
    return timeout(q.order("created_at", { ascending: false }).limit(300), opts.ms || 9000).then(function (r) {
      if (r.error) throw r.status === 404 ? { code: "PGRST205", message: "The resources table doesn't exist yet (HTTP 404)" } : r.error;
      return { rows: (r.data || []).filter(function (x) { return x && String(x.title || "").trim() && (x.url || PATH_RE.test(x.storage_path || "")); }) };
    }).catch(function (e) { return { rows: [], error: String((e && e.message) || e), missing: R.isMissingTable(e) }; });
  };
  // Signed links for every stored file (and its small picture) in ONE request. Sets row._file / row._thumb.
  R.sign = function (rows) {
    var paths = [];
    (rows || []).forEach(function (r) { if (r.storage_path) paths.push(r.storage_path); if (r.thumb_path && PATH_RE.test(r.thumb_path)) paths.push(r.thumb_path); });
    R.signedAt = Date.now();
    if (!paths.length || !AD30.sb || !AD30.sb.storage) return Promise.resolve(rows);
    return timeout(AD30.sb.storage.from(R.BUCKET).createSignedUrls(paths, R.SIGN_SECS), 15000).then(function (res) {
      var map = {};
      ((res && res.data) || []).forEach(function (x) { if (x && x.path && x.signedUrl && !x.error) map[x.path] = x.signedUrl; });
      rows.forEach(function (r) {
        if (r.storage_path) r._file = map[r.storage_path] || null;
        if (r.storage_path) r._thumb = (r.thumb_path && map[r.thumb_path]) || (r.kind === "image" ? r._file : null);
      });
      return rows;
    }, function () { return rows; });
  };
  R.href = function (r) { return r.storage_path ? r._file || "" : r.url || ""; };
  // put fresh links on everything already on the page (after re-signing)
  R.paint = function (rows) {
    (rows || []).forEach(function (r) {
      [].forEach.call(document.querySelectorAll('[data-rsf="' + r.id + '"]'), function (a) { var h = R.href(r); if (h) a.href = h; else a.removeAttribute("href"); });
      [].forEach.call(document.querySelectorAll('img[data-rst="' + r.id + '"]'), function (im) { if (r._thumb && im.getAttribute("src") !== r._thumb) im.src = r._thumb; });
    });
  };
  var live = [];                            // rows currently shown on this page (re-signed together)
  R.keepFresh = function (rows) { live = rows || []; };
  function resign() {
    if (!live.length || Date.now() - (R.signedAt || 0) < R.RESIGN_MS) return;
    R.sign(live).then(R.paint);
  }
  document.addEventListener("visibilitychange", function () { if (!document.hidden) resign(); });
  window.addEventListener("pageshow", resign);
  // a file whose link couldn't be made: try once more, then open it in this tab
  document.addEventListener("click", function (ev) {
    var a = ev.target && ev.target.closest ? ev.target.closest("a[data-rsf]") : null;
    if (!a || a.getAttribute("href")) return;
    ev.preventDefault();
    var r = null; live.forEach(function (x) { if (x.id === a.getAttribute("data-rsf")) r = x; }); if (!r) return;
    R.sign([r]).then(function () { R.paint([r]); if (R.href(r)) location.href = R.href(r); else alert("Couldn’t open this file just now. Check your internet connection and try again."); });
  });

  /* ---------- one resource (member view, Teacher view, admin list) ---------- */
  function icon(r) { return r.kind === "pdf" ? "PDF" : r.kind === "image" ? "IMG" : "LINK"; }
  // opts: { where: "text", id: "element id", cls: "extra class", note: true|false }
  R.item = function (r, opts) {
    opts = opts || {};
    var el = document.createElement("article"), h = R.href(r), img = r.kind === "image" && (r._thumb || (!r.storage_path && r.url));
    el.className = "rs-item rs-k-" + r.kind + (opts.cls ? " " + opts.cls : ""); if (opts.id) el.id = opts.id; el.setAttribute("data-rs", r.id);
    var a = function (cls, inner, label) {
      return '<a class="' + cls + '" data-rsf="' + esc(r.id) + '"' + (h ? ' href="' + esc(h) + '"' : "") + ' target="_blank" rel="noopener noreferrer"' + (label ? ' aria-label="' + esc(label) + '"' : "") + ">" + inner + "</a>";
    };
    el.innerHTML =
      (img ? a("rs-thumb", '<img alt="" loading="lazy" decoding="async" data-rst="' + esc(r.id) + '" src="' + esc(r._thumb || r.url) + '" referrerpolicy="no-referrer">', r.title + " — " + R.openLabel(r))
           : a("rs-icon rs-i-" + r.kind, '<span aria-hidden="true">' + icon(r) + "</span>", r.title + " — " + R.openLabel(r))) +
      '<div class="rs-body">' +
        '<p class="rs-kick">' + esc(R.kindLabel(r)) + (L && L.isNew && L.isNew(r) ? ' <span class="lx-new">NEW</span>' : "") + "</p>" +
        '<h3 class="rs-t">' + a("rs-tl", esc(r.title)) + "</h3>" +
        (opts.where ? '<p class="rs-w">' + esc(opts.where) + "</p>" : "") +
        (opts.note !== false && r.note ? '<div class="rs-note"><p class="rs-lab"><span class="rs-tag">ADMIN’S NOTE</span> <span class="rs-labt">from the Admin — not Scripture</span></p><div class="rs-nt">' +
          (L && L.summaryHTML ? L.summaryHTML(r.note) : "<p>" + esc(r.note) + "</p>") + "</div></div>" : "") +
        '<p class="rs-open">' + a("rs-ol", esc(R.openLabel(r)) + ' <span aria-hidden="true">↗</span>') + "</p>" +
      "</div>";
    return el;
  };
  function byOrder(a, b) {
    var x = a.sort_order == null ? 1e9 : a.sort_order, y = b.sort_order == null ? 1e9 : b.sort_order;
    return x - y || String(a.created_at).localeCompare(String(b.created_at));
  }
  function dateLabel(ts) { return L && L.dateLabel ? L.dateLabel(ts) : ""; }

  /* ===================== member view (simple.html) - called through js/lessons-member.js ===================== */
  var ROWS = null, SHELF_SHOWN = 6;
  function sections() { try { return (window.__simple && window.__simple.sections()) || []; } catch (e) { return []; } }
  function secFor(r) { return L && L.sectionFor ? L.sectionFor(r.marker_id) : null; }
  function secTitle(id) { var S = sections(); for (var i = 0; i < S.length; i++) if (S[i].id === id) return String(S[i].title || "").replace(/^[“"]|[”"]$/g, ""); return ""; }
  function forSection(id) { return (ROWS || []).filter(function (r) { return secFor(r) === id; }).sort(byOrder); }
  /* [notes-match-fix] Which file is which lesson's Study notes. Each file belongs to AT MOST ONE lesson (the best match),
     so a PDF matched to one lesson never shows under another, and is never listed again as a loose file.
     A file matches a lesson when it is in the same place (same timeline spot; for a lesson with no spot: a file with no
     spot) and - best first:
       4  the same title, ignoring case, spaces and punctuation ("RedLetter 7.1a" = "Redletter 7.1A")
          (3 = same title but the file was put on a different spot, or on none)
       2  one title starts with the other ("Daniel 12" / "Daniel 12 study notes") AND the lesson codes are the same
       1  saved within 30 minutes of the lesson at the same spot (the combined Add form) AND the lesson codes are the same
       0.5 only for the "Start here" lesson, only if nothing else matched it: a file whose title or file name has the
          featured words (e.g. thethirtiethyear_deeper_study_notes.pdf)
     Lesson code = every number in the title with its trailing letter: "7.1a", "7.1b", "12", "2.1". Codes must be equal,
     so 7.1a never matches 7.1b. (There is no lesson_id column on resources, so titles/spots are all we have.) */
  function compact(t) { return String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, ""); }
  function codes(t) {
    return (String(t || "").toLowerCase().match(/\d+(?:[.\-:]\d+)*[a-z]?(?![a-z0-9])/g) || [])
      .map(function (c) { return c.replace(/[\-:]/g, "."); }).sort().join(",");
  }
  function fileName(r) { return String(r.storage_path || r.url || "").split(/[?#]/)[0].split("/").pop(); }
  function featTerms() {
    var c = window.AD30_CONFIG ? window.AD30_CONFIG.FEATURED_LESSON : undefined;
    if (c === undefined || c === null) c = ["30th year", "thirtieth"];
    return [].concat(c).map(compact).filter(function (t) { return t.length >= 3; });
  }
  function featHas(text) { var x = compact(text); return !!x && featTerms().some(function (t) { return x.indexOf(t) >= 0; }); }
  function score(r, l) {
    if (!r || !l) return 0;
    var rm = r.marker_id || "", lm = l.marker_id || "", samePlace = rm === lm;
    var a = compact(r.title), b = compact(l.title);
    if (a && a === b) return samePlace ? 4 : 3;
    if (!samePlace) return 0;
    var sameCodes = codes(r.title) === codes(l.title);
    if (a && b && (a.indexOf(b) === 0 || b.indexOf(a) === 0) && sameCodes) return 2;
    if (lm && sameCodes) { var d = Math.abs(Date.parse(r.created_at) - Date.parse(l.created_at)); if (!isNaN(d) && d <= 30 * 60e3) return 1; }
    return 0;
  }
  // lessons: newest first (as fetched). featured: the "Start here" lesson or null. Returns { of: lessonKey -> [files], used: fileId -> lessonKey }
  function lkey(l) { return String(l.id != null ? l.id : (l.marker_id || "") + "|" + l.title + "|" + l.created_at); }
  function assign(files, lessons, featured) {
    var of = {}, used = {};
    (files || []).forEach(function (r) {
      var best = null, bs = 0, bd = Infinity;
      (lessons || []).forEach(function (l) {
        var s = score(r, l); if (!s) return;
        var d = Math.abs(Date.parse(r.created_at) - Date.parse(l.created_at)); if (isNaN(d)) d = 1e15;
        if (s > bs || (s === bs && d < bd)) { best = l; bs = s; bd = d; }
      });
      if (best) { var k = lkey(best); (of[k] = of[k] || []).push(r); used[r.id] = k; }
    });
    if (featured && !of[lkey(featured)]) {
      var c = (files || []).filter(function (r) { return !used[r.id] && (r.marker_id || "") === (featured.marker_id || "") && (featHas(r.title) || featHas(fileName(r))); });
      c.sort(function (a, b) { return (b.kind === "pdf") - (a.kind === "pdf") || byOrder(a, b); });
      if (c.length) { of[lkey(featured)] = [c[0]]; used[c[0].id] = lkey(featured); }
    }
    Object.keys(of).forEach(function (k) { of[k].sort(byOrder); });
    return { of: of, used: used };
  }
  function memberAssign() {
    var ls = (L && L.memberLessons && L.memberLessons()) || [];
    return assign(ROWS || [], ls, (L && L.featured && L.featured()) || null);
  }
  function lessonGuides(l) { return memberAssign().of[lkey(l)] || []; }
  function isLessonGuide(r) { return !!memberAssign().used[r.id]; }
  // admin (js/timeline-placer.js): the files that move with a lesson. Same rule; the featured lesson = the newest one with the words.
  R.lessonGuidesOf = function (files, l, lessons) {
    lessons = lessons && lessons.length ? lessons : [l];
    var feat = null; lessons.forEach(function (x) { if (!feat && featHas(x.title)) feat = x; });
    return assign(files || [], lessons, feat).of[lkey(l)] || [];
  };
  R._match = { compact: compact, codes: codes, score: score, assign: assign };   // for tests
  // [timeline-v3] the separate Resources shelf is gone. A file that is NOT a lesson's Study notes still shows:
  //   at its timeline spot (inside the opened section), or - no spot / a spot not on the member page - in "More lessons".
  function inSpot(r) { return !!(r.marker_id && L && L.marker && L.marker(r.marker_id) && secFor(r)); }
  function fillSpotFiles(scope) {
    if (!ROWS || !(L && L.lessonsLoaded && L.lessonsLoaded())) return;
    [].forEach.call((scope || document).querySelectorAll("[data-spot-files]"), function (box) {
      var id = box.getAttribute("data-spot-files"), list = ROWS.filter(function (r) { return r.marker_id === id && !isLessonGuide(r); }).sort(byOrder);
      box.innerHTML = ""; box.hidden = !list.length;
      list.forEach(function (r) { box.appendChild(R.item(r, { id: "rsm-" + r.id, where: "Added " + dateLabel(r.created_at) })); });
      var sp = box.closest ? box.closest(".lxm-spot") : null, none = sp && sp.querySelector(".lxm-none");
      if (none) none.hidden = !!list.length;
      if (sp && list.length) sp.classList.remove("lxm-spot-empty");
    });
  }
  function fillMoreFiles() {
    var box = $("lxFiles"); if (!box) return;
    if (!ROWS || !(L && L.lessonsLoaded && L.lessonsLoaded())) { box.hidden = true; return; }
    var list = ROWS.filter(function (r) { return !inSpot(r) && !isLessonGuide(r); }).sort(byOrder);
    box.innerHTML = list.length ? '<h3 class="lxm-h2">Files <small>from the Admins</small></h3>' : "";
    list.forEach(function (r) { box.appendChild(R.item(r, { id: "rsx-" + r.id, where: "Added " + dateLabel(r.created_at) })); });
    box.hidden = !list.length;
    if (L.moreVis) L.moreVis();
  }
  function guideLabel(r) {
    if (r.kind === "pdf") return "PDF";
    if (/^https:\/\/drive\.google\.com\/file\/d\//.test(r.url || "")) return "opens in Google Drive";
    return r.kind === "image" ? "picture" : "link";
  }
  // [notes-match-fix] the featured lesson's looser match is now part of assign() above
  function fillGuides(scope) {
    if (!ROWS || !(L && L.lessonsLoaded && L.lessonsLoaded())) return;
    var A = memberAssign();
    [].forEach.call((scope || document).querySelectorAll(".lxm-guide[data-lxg-m]"), function (box) {
      var id = box.getAttribute("data-lxg-id"), row = null;
      if (id) ((L.memberLessons && L.memberLessons()) || []).forEach(function (l) { if (String(l.id) === id) row = l; });
      var k = row ? lkey(row) : lkey({ marker_id: box.getAttribute("data-lxg-m"), title: box.getAttribute("data-lxg-t"), created_at: box.getAttribute("data-lxg-c") });
      var hits = A.of[k] || [];
      box._rsDone = true; box.hidden = !hits.length;   // [notes-match-fix] re-filled every time, so a file never sits under two lessons
      if (!hits.length) { box.innerHTML = ""; return; }
      box.innerHTML = hits.map(function (r) {
        var h = R.href(r);
        return '<a class="lxm-guide-a" data-rsf="' + esc(r.id) + '"' + (h ? ' href="' + esc(h) + '"' : "") + ' target="_blank" rel="noopener noreferrer">' +
          '<span class="lxm-guide-ic" aria-hidden="true">📄</span><span class="lxm-guide-t"><b>Study notes</b>' +
          '<small>' + esc(r.title) + " · " + esc(guideLabel(r)) + '</small></span><span aria-hidden="true">↗</span></a>';
      }).join("");
    });
  }
  function sectionBox(s) {
    var rows = forSection(s.id).filter(function (r) { return !isLessonGuide(r); }); if (!rows.length) return null;   // [studynote-fix] guides sit under their lesson
    var box = document.createElement("div"); box.className = "rsm"; box.setAttribute("data-sec", s.id);
    box.innerHTML = '<h3 class="lxm-h2">' + (rows.length > 1 ? "Resources" : "Resource") + " <small>from the Admins</small></h3>";
    rows.forEach(function (r) { box.appendChild(R.item(r, { id: "rsm-" + r.id, where: "Added " + dateLabel(r.created_at) })); });
    return box;
  }
  function injectPanel(s, el) {
    if (!el || s.extra || el.querySelector(".rsm")) return;
    if (el.querySelector(".lxm-spots")) return;   // [timeline-v3] files now sit at their spot (js/lessons-member.js)
    if (L && L.spotsFor && L.spotsFor(s.id).length) return;
    var box = sectionBox(s); if (!box) return;
    var before = el.querySelector(".sx-notes");
    if (before) el.insertBefore(box, before); else el.appendChild(box);
  }
  function renderShelf() {
    var sec = $("rsShelf"), list = $("rsList"), all = $("rsAll"); if (!sec || !list) return;
    list.innerHTML = "";
    if (!ROWS || !ROWS.length) { sec.hidden = true; return; }
    ROWS.forEach(function (r, i) {
      var s = secFor(r), li = document.createElement("li");
      li.className = "rsm-li"; if (i >= SHELF_SHOWN) li.hidden = true;
      li.appendChild(R.item(r, { id: "rss-" + r.id, where: (s ? "Also in “" + secTitle(s) + "”" : "General") + " · added " + dateLabel(r.created_at) }));
      list.appendChild(li);
    });
    if (all) {
      all.hidden = ROWS.length <= SHELF_SHOWN; all.textContent = "Show all resources (" + ROWS.length + ")";
      all.onclick = function () { [].forEach.call(list.children, function (li) { li.hidden = false; }); all.hidden = true; };
    }
    sec.hidden = false;
  }
  function decorate() {
    if (!ROWS) return;
    sections().forEach(function (s) {
      if (s.extra) return;
      var li = $("s-" + s.id); if (!li) return;
      var n = forSection(s.id).length, d = li.querySelector(".sx-d"), old = li.querySelector(".rsm-cnt");
      if (old) old.parentNode.removeChild(old);
      li.classList.toggle("has-resource", n > 0);
      if (!n || !d) return;
      var sp = document.createElement("span"); sp.className = "rsm-cnt"; sp.textContent = " · " + (n > 1 ? n + " resources" : "resource");
      d.appendChild(sp);
    });
  }
  // same "keep what the member is looking at in place" as js/lessons-member.js (the shelf sits above the sections)
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
  var loading = null;
  R.member = {
    load: function () {
      if (loading) return loading;
      loading = R.fetch().then(function (res) { return R.sign(res.rows).then(function (rows) { return [res, rows]; }); }).then(function (x) {
        try {
          ROWS = x[1]; R.keepFresh(ROWS);
          var anchor = keepPlace();
          renderShelf(); decorate();
          sections().forEach(function (s) { var li = $("s-" + s.id), inner = li && li.querySelector(".sx-in"); if (inner && inner.firstChild) injectPanel(s, inner); });
          fillGuides(document);   // [studynote-fix]
          fillSpotFiles(document); fillMoreFiles();   // [timeline-v3]
          anchor();
        } catch (e) { if (window.console) console.warn("[resources]", e); }
        return x[0];
      });
      return loading;
    },
    panel: function (s, el) { if (ROWS) { injectPanel(s, el); fillGuides(el); fillSpotFiles(el); } },
    spotFiles: fillSpotFiles, moreFiles: fillMoreFiles,   // [timeline-v3]
    guides: fillGuides,   // [studynote-fix] called by js/lessons-member.js for each lesson it draws
    decorate: decorate,
    // Study notes / print: titles and the leader's notes only (not the files)
    notes: function (s) {
      if (s.extra) return "";
      var rows = forSection(s.id); if (!rows.length) return "";
      var h = '<section class="rsn"><h2 class="nt-th">' + (rows.length > 1 ? "Resources" : "Resource") + '</h2><p class="nt-note">From the Admins. Open the files on the website.</p>';
      rows.forEach(function (r) {
        h += '<div class="rsn-r"><h3 class="rsn-t">' + esc(r.title) + ' <small class="rsn-k">(' + esc(R.kindLabel(r)) + ")</small></h3>" +
          (r.note ? '<p class="rsn-lab"><span class="rs-tag">ADMIN’S NOTE</span></p><div class="rsn-n">' + (L && L.summaryHTML ? L.summaryHTML(r.note) : esc(r.note)) + "</div>" : "") + "</div>";
      });
      return h + "</section>";
    },
    _rows: function () { return ROWS; }
  };

  /* ===================== Teacher view (index.html) - called from AD30L.timeline ===================== */
  R.timeline = function (tl) {
    var top = $("rsTop"), strip = $("rsStrip"); if (!top || !strip) return Promise.resolve();
    return R.fetch().then(function (res) { return R.sign(res.rows); }).then(function (rows) {
      try {
        if (!rows.length) return;
        R.keepFresh(rows);
        rows.slice().sort(byOrder).forEach(function (r) {
          var li = R.validMarker(r.marker_id) ? $(r.marker_id) : null;
          r._where = "General";
          if (!li || !li.classList.contains("ev") || li.classList.contains("sv") || $("rsf-" + r.id)) return;
          var body = li.querySelector(".body"); if (!body) return;
          var box = document.createElement("div"); box.className = "rs-fig"; box.id = "rsf-" + r.id;
          box.appendChild(R.item(r, { where: "Resource from the Admins · added " + dateLabel(r.created_at) }));
          body.appendChild(box);
          var t = li.querySelector(".ttl"), d = li.querySelector(".dt");
          r._where = (t ? t.textContent : "") + (d && L ? " · " + L.shortDate(d.textContent) : "");
          var pv = li.querySelector(".pv");
          if (pv && !pv.querySelector(".hasr")) { var s = document.createElement("span"); s.className = "hasr"; s.textContent = "📎"; s.title = "Has a resource"; pv.insertBefore(s, pv.firstChild); }
        });
        rows.forEach(function (r) {        // newest first
          var card = document.createElement("div"); card.className = "rs-card"; card.setAttribute("role", "listitem");
          card.appendChild(R.item(r, { where: r._where, note: false, id: "rsc-" + r.id }));
          if (r._where !== "General" && tl.openTarget) {
            var b = document.createElement("button"); b.type = "button"; b.className = "rs-go"; b.textContent = "Show on the timeline →";
            b.addEventListener("click", function () { tl.openTarget(r.marker_id); setTimeout(function () { var f = $("rsf-" + r.id); if (f) f.scrollIntoView({ block: "center" }); }, 120); });
            card.appendChild(b);
          }
          strip.appendChild(card);
        });
        top.hidden = false;
      } catch (e) { if (window.console) console.warn("[resources]", e); }
    });
  };
})();
