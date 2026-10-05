/* AD30 members - group leader view: "Add a resource" card (admin.html).                              [drive-resources, new file]
   Needs js/lessons.js (timeline markers, dates) and js/resources.js (checks, list rendering). Started by admin.js once the
   database confirms this person is an admin (AD30RA.start). A leader can upload a PDF or a picture (PNG / JPG / WebP,
   up to 45 MB - checked here before uploading, and again by the storage bucket) or add a link, with a title, their own
   note and an optional timeline marker. The database enforces who may add / delete (RLS + storage policies: public.admins). */
(function () {
  "use strict";
  var AD30 = window.AD30, L = window.AD30L, R = window.AD30R;
  if (!AD30 || !L || !R) return;
  var $ = AD30.$, esc = AD30.esc;
  var A = (window.AD30RA = {});
  var rows = [], started = false, missing = false, fileState = { error: "empty" }, linkState = { error: "empty" }, previewUrl = null;
  var MIG = "migrations/2026-10-04_drive_resources.sql";
  var MISSING = { code: "PGRST205", message: "The resources table doesn't exist yet (HTTP 404)" };

  function mode() { var c = document.querySelector('input[name="rsMode"]:checked'); return c ? c.value : "file"; }
  function say(el, text, kind) { el.textContent = text || ""; el.className = "msg" + (kind ? " " + kind : ""); }
  function help(el, html, kind) { el.innerHTML = html; el.className = kind || "lx-help"; }
  function where(id) {
    if (!id) return "General (Resources list only)";
    var m = L.marker(id); return m ? L.markerLabel(m) : "Timeline marker “" + id + "” (no longer on the timeline)";
  }
  function fillSelect() {
    var sel = $("rsMarker"), cur = sel.value, groups = {}, order = [];
    sel.innerHTML = '<option value="">General (Resources list only)</option>';
    L.MARKERS.forEach(function (m) { if (!groups[m.sec]) { groups[m.sec] = []; order.push(m.sec); } groups[m.sec].push(m); });
    order.forEach(function (s) {
      var g = document.createElement("optgroup"); g.label = s || "Timeline";
      groups[s].forEach(function (m) { var o = document.createElement("option"); o.value = m.id; o.textContent = L.markerLabel(m); g.appendChild(o); });
      sel.appendChild(g);
    });
    sel.value = cur || "";
  }

  /* ---------- the file / link and what type it is ---------- */
  var FILE_ERR = {
    heic: "That’s an iPhone HEIC photo, which browsers can’t show everywhere. Please choose a JPG or PNG (in Photos: Share → Save as JPEG, or take a screenshot of it).",
    type: "That type of file can’t be added. Please choose a PDF, or a picture: PNG, JPG or WebP.",
    size: "That file is too big (over 45 MB). Please make it smaller (e.g. “Reduce file size” / export at a lower quality) and choose it again.",
    zero: "That file is empty. Please choose it again."
  };
  function showType() {
    var t = $("rsType"), s = mode() === "file" ? fileState : linkState;
    if (s.error) { t.textContent = ""; return; }
    t.textContent = "Type: " + (mode() === "file" ? (s.kind === "pdf" ? "PDF" : "Picture") + " · " + R.size(s.size) : (s.kind === "pdf" ? "PDF link" : s.kind === "image" ? "Picture link" : "Link")) + " (worked out for you)";
  }
  function checkFile() {
    var f = $("rsFile").files && $("rsFile").files[0], r = R.checkFile(f), msg = $("rsFileMsg"), prev = $("rsFPrev");
    if (previewUrl) { try { URL.revokeObjectURL(previewUrl); } catch (e) {} previewUrl = null; }
    fileState = r; if (!r.error) { r.file = f; r.size = f.size; }
    prev.hidden = true;
    if (r.error) {
      help(msg, r.error === "empty" ? "PDF, PNG, JPG or WebP, up to 45 MB." : FILE_ERR[r.error], r.error === "empty" ? "lx-help" : "lx-warn");
      showType(); return;
    }
    help(msg, "Ready to add ✓ " + esc(f.name) + " (" + R.size(f.size) + ")", "lx-good");
    if (r.kind === "image") {
      previewUrl = URL.createObjectURL(f); $("rsFPrevImg").src = previewUrl; $("rsFPrevImg").hidden = false; $("rsFPrevTxt").textContent = "";
    } else { $("rsFPrevImg").hidden = true; $("rsFPrevImg").removeAttribute("src"); $("rsFPrevTxt").textContent = "📄 " + f.name; }
    prev.hidden = false;
    if (!$("rsTitle").value.trim()) $("rsTitle").value = f.name.replace(/\.[a-z0-9]{1,5}$/i, "").replace(/[_-]+/g, " ").trim().slice(0, 200);
    showType();
  }
  function checkLink(final) {
    var v = $("rsUrl").value, r = R.checkUrl(v), msg = $("rsUrlMsg");
    linkState = r;
    if (r.error === "empty") help(msg, "Paste a web address starting with https://");
    else if (r.error === "nothttps") help(msg, "Please use a secure link that starts with <b>https://</b> (most sites work if you change http:// to https://).", "lx-warn");
    else if (r.error) { if (final || v.length > 10) help(msg, "That doesn’t look like a web link. Copy the address from the page and paste it here.", "lx-warn"); }
    else help(msg, "Link looks right ✓ " + esc(r.url.length > 60 ? r.url.slice(0, 57) + "…" : r.url), "lx-good");
    showType();
  }
  function setMode() {
    var m = mode();
    $("rsFileBox").hidden = m !== "file"; $("rsLinkBox").hidden = m !== "link";
    $("rsSave").textContent = m === "file" ? "Upload and add" : "Add link";
    showType();
  }

  /* ---------- small picture for the member pages (so phones don't download a 20 MB chart just to show a thumbnail) ---------- */
  function makeThumb(file) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(file), img = new Image(), done = false;
      var finish = function (b) { if (done) return; done = true; try { URL.revokeObjectURL(url); } catch (e) {} resolve(b); };
      setTimeout(function () { finish(null); }, 15000);
      img.onload = function () {
        try {
          var w = img.naturalWidth, h = img.naturalHeight; if (!w || !h) return finish(null);
          var k = Math.min(1, 640 / Math.max(w, h)), c = document.createElement("canvas");
          c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
          var x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
          if (!c.toBlob) return finish(null);
          c.toBlob(function (b) { finish(b && b.size ? b : null); }, "image/jpeg", 0.82);
        } catch (e) { finish(null); }
      };
      img.onerror = function () { finish(null); };
      img.src = url;
    });
  }
  function rand() {
    var a = new Uint8Array(16), s = "";
    (window.crypto || window.msCrypto).getRandomValues(a);
    for (var i = 0; i < a.length; i++) s += ("0" + a[i].toString(16)).slice(-2);
    return s;
  }
  function safeName(name, ext) {
    var base = String(name || "file").replace(/\.[a-z0-9]{1,5}$/i, "").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^[-.]+|[-.]+$/g, "").slice(0, 80) || "file";
    return base + "." + ext;
  }

  /* ---------- save ---------- */
  function errText(e) {
    var m = String((e && (e.message || e.error || e.details || e.hint)) || (e && typeof e === "object" ? JSON.stringify(e) : e) || ""), code = String(e && (e.code || e.statusCode || e.status) || "");
    if (R.isMissingTable(e) || /bucket not found/i.test(m)) return "Resources aren’t switched on yet: Ben needs to run one setup step in Supabase (" + MIG + "). Nothing was saved.";
    if (code === "42501" || code === "403" || /row-level security|permission denied|unauthorized/i.test(m)) return "Only group leaders can do this, and the database doesn’t list this email as one. Nothing was saved.";
    if (code === "413" || /too large|exceeded the maximum/i.test(m)) return FILE_ERR.size;
    if (/mime type|not supported/i.test(m)) return FILE_ERR.type;
    if (code === "23514" || /check constraint/i.test(m)) return "Something in the form isn’t allowed (for example a title that is too long). Nothing was saved.";
    if (/timeout|fetch|network|load failed/i.test(m)) return "Couldn’t reach the website’s database. Check your internet connection and try again.";
    return "Couldn’t save: " + m;
  }
  function busy(on, text) { var b = $("rsSave"); b.disabled = on; if (on) b.textContent = text; else setMode(); }
  function storage() { return AD30.sb.storage.from(R.BUCKET); }
  function onSave(ev) {
    ev.preventDefault();
    var msg = $("rsMsg"), title = $("rsTitle").value.trim(), m = mode();
    var row = { title: title.slice(0, 200), note: $("rsNote").value.trim() || null, marker_id: $("rsMarker").value || null };
    if (row.marker_id && !L.validMarker(row.marker_id)) row.marker_id = null;
    if (m === "file") {
      checkFile();
      if (fileState.error) { say(msg, fileState.error === "empty" ? "Please choose a file (PDF or picture)." : "Please check the file (see the note under it).", "err"); return; }
    } else {
      checkLink(true);
      if (linkState.error) { say(msg, linkState.error === "empty" ? "Please paste the link." : "Please check the link (see the note under it).", "err"); $("rsUrl").focus(); return; }
    }
    if (!row.title) { say(msg, "Please type a title.", "err"); $("rsTitle").focus(); return; }
    say(msg, "");
    if (m === "link") {
      row.kind = linkState.kind; row.url = linkState.url;
      busy(true, "Adding…");
      return insert(row, []);
    }
    var fs = fileState, d = new Date(), dir = d.getFullYear() + "/" + ("0" + (d.getMonth() + 1)).slice(-2) + "/" + rand() + "/";
    row.kind = fs.kind; row.mime = fs.mime; row.size_bytes = fs.size; row.storage_path = dir + safeName(fs.file.name, fs.ext);
    var body = fs.file.type === fs.mime ? fs.file : fs.file.slice(0, fs.file.size, fs.mime), uploaded = [];
    busy(true, "Uploading…" + (fs.size > 5242880 ? " (a big file can take a minute)" : ""));
    say(msg, "Uploading " + R.size(fs.size) + "… please keep this page open.");
    R.timeout(storage().upload(row.storage_path, body, { contentType: fs.mime, upsert: false, cacheControl: "3600" }), 10 * 60 * 1000).then(function (r) {
      if (r.error) throw r.error;
      uploaded.push(row.storage_path);
      if (fs.kind !== "image") return null;
      return makeThumb(fs.file).then(function (blob) {
        if (!blob) return null;
        var tp = dir + "preview-" + rand().slice(0, 8) + ".jpg";
        return R.timeout(storage().upload(tp, blob, { contentType: "image/jpeg", upsert: false, cacheControl: "3600" }), 60000).then(function (t) {
          if (!t.error) { uploaded.push(tp); row.thumb_path = tp; }
        }, function () {});
      });
    }).then(function () { return insert(row, uploaded); }, function (e) {
      busy(false); say(msg, errText(e), "err");
    });
  }
  function insert(row, uploaded) {
    var msg = $("rsMsg");
    return R.timeout(AD30.sb.from("resources").insert(row).select("id,title,marker_id,kind"), 15000).then(function (r) {
      if (r.error && r.status === 404) throw MISSING;      // PostgREST: table not there yet (migration not run)
      if (r.error || !r.data || !r.data.length) throw r.error || { message: "AD30_NOT_SAVED" };
      busy(false);
      clearForm();
      say(msg, "Added ✓ “" + r.data[0].title + "” is on the site now — " + (r.data[0].marker_id ? where(r.data[0].marker_id) + ", and in “Resources”." : "in “Resources” at the top of the member page."), "ok");
      msg.scrollIntoView({ block: "center", behavior: "smooth" });
      loadList();
    }).catch(function (e) {
      busy(false);
      say(msg, errText(e && e.message === "AD30_NOT_SAVED" ? { message: "That didn’t save. Reload the page and try again." } : e), "err");
      if (uploaded.length) storage().remove(uploaded).then(function () {}, function () {});   // don't leave an orphan file behind
      if (R.isMissingTable(e)) showMissing();
    });
  }
  function clearForm() {
    $("rsForm").reset(); fileState = { error: "empty" }; linkState = { error: "empty" };
    if (previewUrl) { try { URL.revokeObjectURL(previewUrl); } catch (e) {} previewUrl = null; }
    $("rsFPrev").hidden = true; fillSelect(); setMode(); checkFile(); checkLink(false);
  }

  /* ---------- list + delete ---------- */
  function showMissing() {
    missing = true;
    $("rsListMsg").textContent = "Not switched on yet — resources need one setup step in Supabase (run " + MIG + " in the SQL Editor). Adding won’t work until then.";
    $("rsListMsg").className = "hint lx-warn";
  }
  function loadList() {
    return R.fetch({ all: true, ms: 15000 }).then(function (res) {
      if (res.missing) { rows = []; showMissing(); paint(); return; }
      if (res.error) { $("rsListMsg").textContent = "Couldn’t load the resources just now (" + res.error + "). Reload the page to try again."; $("rsListMsg").className = "hint lx-warn"; return; }
      missing = false; $("rsListMsg").className = "hint";
      return R.sign(res.rows).then(function (list) {
        rows = list; R.keepFresh(rows);
        $("rsListMsg").textContent = rows.length ? "Newest first. Tap Delete to remove one from the site." : "";
        paint();
      });
    });
  }
  function paint() {
    var ul = $("rsItems"); ul.innerHTML = "";
    if (!rows.length) { if (!missing) ul.innerHTML = '<li class="lx-empty">No resources yet — add the first one above.</li>'; return; }
    rows.forEach(function (r) {
      var li = document.createElement("li"); li.className = "lx-item rs-aitem"; li.setAttribute("data-rs", r.id);
      li.appendChild(R.item(r, { where: where(r.marker_id) + " · added " + L.dateLabel(r.created_at) + (r.created_by ? " by " + r.created_by : "") + (r.size_bytes ? " · " + R.size(r.size_bytes) : "") }));
      var acts = document.createElement("div"); acts.className = "lx-acts";
      acts.innerHTML = '<button type="button" class="del" data-a="del">Delete</button>';
      acts.querySelector("button").addEventListener("click", function (e) {
        if (!confirm("Delete “" + r.title + "” from the site?\n\nThis can’t be undone." + (r.storage_path ? " The uploaded file is deleted too." : ""))) return;
        var b = e.currentTarget; b.disabled = true;
        R.timeout(AD30.sb.from("resources").delete().eq("id", r.id).select("id"), 15000).then(function (res) {
          if (res.error && res.status === 404) throw MISSING;
          if (res.error || !res.data || !res.data.length) throw res.error || { message: "Nothing was deleted - reload the page and try again." };
          var files = [r.storage_path, r.thumb_path].filter(Boolean);
          if (!files.length) return "";
          return R.timeout(storage().remove(files), 30000).then(function (x) { return x && x.error ? " (The file itself couldn’t be removed from storage just now; it’s no longer shown anywhere.)" : ""; }, function () { return " (The file itself couldn’t be removed from storage just now; it’s no longer shown anywhere.)"; });
        }).then(function (extra) {
          say($("rsMsg"), "Deleted “" + r.title + "”." + (extra || ""), "ok");
          loadList();
        }, function (err) { b.disabled = false; alert(errText(err)); });
      });
      li.appendChild(acts);
      ul.appendChild(li);
    });
  }

  /* ---------- start (called by admin.js after the admin check) ---------- */
  A.start = function () {
    if (started || !$("rsAdmin")) return; started = true;
    $("rsAdmin").hidden = false;
    fillSelect();
    if (window.AD30LA && window.AD30LA.markersP) window.AD30LA.markersP.then(fillSelect, function () {});
    [].forEach.call(document.querySelectorAll('input[name="rsMode"]'), function (r) { r.addEventListener("change", setMode); });
    $("rsFile").addEventListener("change", checkFile);
    $("rsUrl").addEventListener("input", function () { checkLink(false); });
    $("rsUrl").addEventListener("blur", function () { if ($("rsUrl").value.trim()) checkLink(true); });
    $("rsForm").addEventListener("submit", onSave);
    setMode();
    loadList();
  };
  A._state = function () { return { rows: rows, missing: missing, file: fileState, link: linkState }; };
})();
