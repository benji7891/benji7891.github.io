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
        (opts.note !== false && r.note ? '<div class="rs-note"><p class="rs-lab"><span class="rs-tag">LEADER’S NOTE</span> <span class="rs-labt">from the group leader — not Scripture</span></p><div class="rs-nt">' +
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
  function sectionBox(s) {
    var rows = forSection(s.id); if (!rows.length) return null;
    var box = document.createElement("div"); box.className = "rsm"; box.setAttribute("data-sec", s.id);
    box.innerHTML = '<h3 class="lxm-h2">' + (rows.length > 1 ? "Resources" : "Resource") + " <small>from the group leaders</small></h3>";
    rows.forEach(function (r) { box.appendChild(R.item(r, { id: "rsm-" + r.id, where: "Added " + dateLabel(r.created_at) })); });
    return box;
  }
  function injectPanel(s, el) {
    if (!el || s.extra || el.querySelector(".rsm")) return;
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
          anchor();
        } catch (e) { if (window.console) console.warn("[resources]", e); }
        return x[0];
      });
      return loading;
    },
    panel: function (s, el) { if (ROWS) injectPanel(s, el); },
    decorate: decorate,
    // Study notes / print: titles and the leader's notes only (not the files)
    notes: function (s) {
      if (s.extra) return "";
      var rows = forSection(s.id); if (!rows.length) return "";
      var h = '<section class="rsn"><h2 class="nt-th">' + (rows.length > 1 ? "Resources" : "Resource") + '</h2><p class="nt-note">From the group leaders. Open the files on the website.</p>';
      rows.forEach(function (r) {
        h += '<div class="rsn-r"><h3 class="rsn-t">' + esc(r.title) + ' <small class="rsn-k">(' + esc(R.kindLabel(r)) + ")</small></h3>" +
          (r.note ? '<p class="rsn-lab"><span class="rs-tag">LEADER’S NOTE</span></p><div class="rsn-n">' + (L && L.summaryHTML ? L.summaryHTML(r.note) : esc(r.note)) + "</div>" : "") + "</div>";
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
          box.appendChild(R.item(r, { where: "Resource from the group leaders · added " + dateLabel(r.created_at) }));
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
