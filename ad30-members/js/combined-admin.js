/* AD30 members - Admin view: ONE simple "Add a lesson" form (video and/or PDF).          [admin-combined, new file]
   Saving creates a row in public.lessons (if a video link is given) and/or public.resources (if a PDF file or link is given),
   both with the same timeline spot. Editing still uses the existing lesson / resource edit forms (opened by the Edit buttons). */
(function () {
  "use strict";
  var AD30 = window.AD30, L = window.AD30L, R = window.AD30R;
  if (!AD30 || !L || !R) return;
  var $ = AD30.$, esc = AD30.esc, started = false, A = (window.AD30CA = {});
  function say(t, k) { var m = $("cbMsg"); m.innerHTML = t || ""; m.className = "msg" + (k ? " " + k : ""); }
  function help(el, html, k) { el.innerHTML = html; el.className = k || "lx-help"; }
  function pdfMode() { var c = document.querySelector('input[name="cbPdfMode"]:checked'); return c ? c.value : "file"; }
  function fillSelect() {
    var sel = $("cbMarker"), cur = sel.value, groups = {}, order = [];
    sel.innerHTML = '<option value="">More lessons (no timeline date)</option>';
    L.MARKERS.forEach(function (m) { if (!groups[m.sec]) { groups[m.sec] = []; order.push(m.sec); } groups[m.sec].push(m); });
    order.forEach(function (s) {
      var g = document.createElement("optgroup"); g.label = s || "Timeline";
      groups[s].forEach(function (m) { var o = document.createElement("option"); o.value = m.id; o.textContent = L.markerLabel(m); g.appendChild(o); });
      sel.appendChild(g);
    });
    sel.value = cur || "";
  }
  function video() {
    var v = $("cbUrl").value.trim(), r = v ? L.parseVideo(v) : { error: "empty" }, msg = $("cbUrlMsg");
    if (r.error === "empty") help(msg, "Google Drive or YouTube. In Drive set sharing to <b>Anyone with the link</b> (Viewer).");
    else if (r.error) help(msg, "That isn’t a Google Drive or YouTube video link. In Drive: open the video → <b>Share</b> → <b>Copy link</b>.", "lx-warn");
    else help(msg, (r.source === "drive" ? "Google Drive" : "YouTube") + " video found ✓", "lx-good");
    return r;
  }
  function pdf() {
    var out = { error: "empty" }, msg = $("cbPdfMsg");
    if (pdfMode() === "file") {
      var f = $("cbFile").files && $("cbFile").files[0];
      if (f) { out = R.checkFile(f); if (!out.error) { out.file = f; out.size = f.size; out.isFile = true; } }
      if (out.error === "empty") help(msg, "PDF (or a picture), up to 45 MB.");
      else if (out.error) help(msg, "Please choose a PDF or a PNG/JPG picture under 45 MB.", "lx-warn");
      else help(msg, "Ready ✓ " + esc(f.name) + " (" + R.size(f.size) + ")", "lx-good");
    } else {
      var v = $("cbPdfUrl").value.trim();
      if (v) out = R.checkUrl(v);
      if (out.error === "empty") help(msg, "Paste a link starting with https:// (for example a Google Drive PDF link).");
      else if (out.error) help(msg, "Please paste a full link starting with <b>https://</b>", "lx-warn");
      else help(msg, "Link looks right ✓", "lx-good");
    }
    return out;
  }
  function setMode() { var f = pdfMode() === "file"; $("cbFileBox").hidden = !f; $("cbLinkBox").hidden = f; pdf(); }
  function busy(on, t) { var b = $("cbSave"); b.disabled = on; b.textContent = on ? t : "Save"; }
  function onSave(ev) {
    ev.preventDefault();
    var title = $("cbTitle").value.trim(), v = video(), p = pdf(), marker = $("cbMarker").value || null, note = $("cbNote").value.trim() || null;
    if (marker && !L.validMarker(marker)) marker = null;
    if (!title) { say("Please type a title.", "err"); $("cbTitle").focus(); return; }
    var hasV = !v.error, hasP = !p.error;
    if (!hasV && !hasP) { say(v.error !== "empty" || p.error !== "empty" ? "Please check the video or PDF link (see the note under it)." : "Add a video link, a PDF, or both.", "err"); return; }
    if (v.error && v.error !== "empty") { say("Please check the video link (see the note under it).", "err"); return; }
    if (p.error && p.error !== "empty") { say("Please check the PDF (see the note under it).", "err"); return; }
    var done = [], url = $("cbUrl").value.trim();
    var step = Promise.resolve();
    if (hasV) step = step.then(function () {
      busy(true, "Saving video…");
      var row = { title: title.slice(0, 200), youtube_url: url.slice(0, 500), youtube_id: v.source === "youtube" ? v.id : null, marker_id: marker, summary: note, verse_refs: null };
      if (v.source === "drive") { row.video_source = "drive"; row.drive_id = v.id; }
      return L.save(row, null).then(function (r) { if (r.error) throw r.error; done.push("video"); });
    });
    if (hasP) step = step.then(function () {
      busy(true, p.isFile ? "Uploading PDF…" : "Saving PDF…");
      var row = { title: title.slice(0, 200), note: note, marker_id: marker };
      var up = p.isFile ? window.AD30RA.uploadFile(p) : Promise.resolve({ row: { kind: p.kind, url: p.url }, uploaded: [] });
      return up.then(function (u) {
        Object.keys(u.row).forEach(function (k) { row[k] = u.row[k]; });
        return R.timeout(AD30.sb.from("resources").insert(row).select("id,title"), 15000).then(function (r) {
          if (r.error || !r.data || !r.data.length) { if (u.uploaded.length) AD30.sb.storage.from(R.BUCKET).remove(u.uploaded); throw r.error || { message: "That didn’t save." }; }
          done.push("PDF");
        });
      });
    });
    step.then(function () {
      busy(false); $("cbForm").reset(); setMode(); video();
      say("Saved ✓ “" + esc(title) + "” — " + done.join(" and ") + " now on the site.", "ok");
    }).catch(function (e) {
      busy(false);
      var m = String((e && (e.message || e.code)) || e);
      say((done.length ? "The " + done.join(" and ") + " saved, but the rest didn’t: " : "Nothing was saved: ") +
        (/42501|row-level|permission/i.test(m + (e && e.code)) ? "this email isn’t on the database’s Admin list." : esc(m)), "err");
    }).then(function () {
      if (window.AD30LA && AD30LA.reload) AD30LA.reload();
      if (window.AD30RA && AD30RA.reload) AD30RA.reload();
    });
  }
  A.start = function () {
    if (started || !$("cbAdmin")) return; started = true;
    $("cbAdmin").hidden = false; fillSelect();
    if (window.AD30LA && AD30LA.markersP) AD30LA.markersP.then(fillSelect, function () {});
    [].forEach.call(document.querySelectorAll('input[name="cbPdfMode"]'), function (r) { r.addEventListener("change", setMode); });
    $("cbUrl").addEventListener("input", video); $("cbFile").addEventListener("change", pdf); $("cbPdfUrl").addEventListener("input", pdf);
    $("cbForm").addEventListener("submit", onSave);
    setMode(); video();
  };
})();
