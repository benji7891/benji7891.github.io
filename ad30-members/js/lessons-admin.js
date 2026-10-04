/* AD30 members - group leader view: "Add a lesson" card (admin.html). Needs js/lessons.js.
   Started by admin.js once the database confirms this person is an admin (AD30LA.start).
   The database enforces who may write (RLS: public.admins); this page only makes it easy. */
(function () {
  "use strict";
  var AD30 = window.AD30, L = window.AD30L;
  if (!AD30 || !L) return;
  var $ = AD30.$, esc = AD30.esc, LS = AD30.LS;
  var A = (window.AD30LA = {});
  var DRAFT = "ad30m.lessonDraft";
  var rows = [], editing = null, markers = L.MARKERS.slice(), missing = false, started = false;
  var urlState = { id: null, error: "empty" }, seq = 0, refSeq = 0;

  function say(el, text, kind) { el.textContent = text || ""; el.className = (el.id === "lxMsg" ? "msg" : el.className.replace(/\blx-(warn|good|help)\b/g, "").trim()) + (kind ? " " + kind : ""); }
  function setHelp(el, html, kind) { el.innerHTML = html; el.className = kind || "lx-help"; }
  function debounce(fn, ms) { var t; return function () { var a = arguments; clearTimeout(t); t = setTimeout(function () { fn.apply(null, a); }, ms); }; }
  function where(id) {
    if (!id) return "General (top of page)";
    for (var i = 0; i < markers.length; i++) if (markers[i].id === id) return L.markerLabel(markers[i]);
    return "Timeline marker “" + id + "” (no longer on the timeline)";
  }

  /* ---------- "Where on the timeline": read the real markers from the timeline page ---------- */
  function readMarkers() {
    return fetch("index.html", { cache: "no-cache", credentials: "same-origin" }).then(function (r) { if (!r.ok) throw 0; return r.text(); }).then(function (html) {
      var doc = new DOMParser().parseFromString(html, "text/html"), out = [], sec = "";
      [].forEach.call(doc.querySelectorAll("h2.sh, li.ev"), function (el) {
        if (el.tagName === "H2") {
          var sm = el.querySelector("small"), smt = sm ? sm.textContent.trim() : "";
          if (sm) sm.remove(); sec = el.textContent.trim() + (smt && smt.length <= 22 ? " · " + smt : ""); return;
        }
        var t = el.querySelector(".ttl"), d = el.querySelector(".dt");
        if (!el.id || !t || !L.validMarker(el.id)) return;
        out.push({ id: el.id, sec: sec, dt: d ? d.textContent.trim() : "", ttl: t.textContent.trim() });
      });
      if (out.length >= 10) { markers = out; L.MARKERS = out; }
    }).catch(function () { /* keep the built-in list */ });
  }
  function fillSelect(keep) {
    var sel = $("lxMarker"), cur = keep != null ? keep : sel.value, groups = {}, order = [];
    sel.innerHTML = '<option value="">General (top of page)</option>';
    markers.forEach(function (m) { if (!groups[m.sec]) { groups[m.sec] = []; order.push(m.sec); } groups[m.sec].push(m); });
    order.forEach(function (s) {
      var g = document.createElement("optgroup"); g.label = s || "Timeline";
      groups[s].forEach(function (m) { var o = document.createElement("option"); o.value = m.id; o.textContent = L.markerLabel(m); g.appendChild(o); });
      sel.appendChild(g);
    });
    if (cur && !sel.querySelector('option[value="' + cur.replace(/[^\w-]/g, "") + '"]')) {
      var o = document.createElement("option"); o.value = cur; o.textContent = where(cur); sel.appendChild(o);
    }
    sel.value = cur || "";
  }

  /* ---------- YouTube link: check + picture + title from YouTube ---------- */
  var URL_ERR = {
    notlink: "That doesn’t look like a link. In YouTube tap <b>Share</b> → <b>Copy link</b>, then paste it here.",
    notyoutube: "That link isn’t a YouTube link. Please paste the link from YouTube.",
    playlist: "That’s a playlist link. Open the single video, tap <b>Share</b> → <b>Copy link</b>, and paste that.",
    noid: "We couldn’t find the video in that link. In YouTube tap <b>Share</b> → <b>Copy link</b>, then paste it here."
  };
  function checkUrl(final) {
    var v = $("lxUrl").value, r = L.parseYouTube(v), msg = $("lxUrlMsg"), prev = $("lxPrev"), my = ++seq;
    urlState = r;
    if (r.error) {
      prev.hidden = true;
      if (r.error === "empty") setHelp(msg, "In YouTube, tap <b>Share</b> → <b>Copy link</b>, then paste it here.");
      else if (final || v.length > 12) setHelp(msg, URL_ERR[r.error], "lx-warn");
      return;
    }
    var dup = rows.filter(function (x) { return x.youtube_id === r.id && (!editing || x.id !== editing.id); })[0];
    setHelp(msg, "Video found ✓" + (dup ? " — <b>but you already added this video</b> (“" + esc(dup.title) + "”)." : ""), dup ? "lx-warn" : "lx-good");
    prev.hidden = false;
    var img = $("lxPrevImg");
    img.onerror = function () { if (my === seq) setHelp(msg, "We couldn’t load a picture for this video. Check the link is complete and the video is <b>Unlisted</b> or Public (not Private).", "lx-warn"); };
    img.src = L.thumb(r.id);
    $("lxPrevTxt").textContent = "Checking with YouTube…";
    fetch("https://www.youtube.com/oembed?format=json&url=" + encodeURIComponent("https://www.youtube.com/watch?v=" + r.id), { credentials: "omit" })
      .then(function (res) {
        if (my !== seq) return;
        if (res.status === 401 || res.status === 403) {
          $("lxPrevTxt").textContent = "";
          setHelp(msg, "YouTube won’t let this video play on other websites. It may be <b>Private</b>, or “Allow embedding” is off. Make it <b>Unlisted</b> and allow embedding in YouTube Studio.", "lx-warn");
          return;
        }
        if (res.status === 404 || res.status === 400) {
          $("lxPrevTxt").textContent = "";
          setHelp(msg, "YouTube says this video can’t be found. Check the link is complete and the video isn’t Private (Unlisted is fine). If you only just uploaded it, wait a minute and try again.", "lx-warn");
          return;
        }
        if (!res.ok) throw 0;
        return res.json().then(function (j) {
          if (my !== seq || !j) return;
          var t = String(j.title || "").slice(0, 200), au = String(j.author_name || "").slice(0, 100);
          var p = $("lxPrevTxt"); p.innerHTML = ""; var b = document.createElement("b"); b.textContent = t || "YouTube video"; p.appendChild(b);
          if (au) p.appendChild(document.createTextNode(" · " + au));
          if (t && !$("lxTitle").value.trim()) { $("lxTitle").value = t; saveDraft(); p.appendChild(document.createTextNode(" — title filled in from YouTube (change it if you like).")); }
        });
      }).catch(function () { if (my === seq) $("lxPrevTxt").textContent = "Video link looks right."; });
  }

  /* ---------- verse references: live preview of the exact KJV ---------- */
  function checkRefs() {
    var text = $("lxRefs").value.trim(), box = $("lxVerses"), my = ++refSeq;
    if (!text) { box.innerHTML = ""; return; }
    box.innerHTML = '<p class="lx-help">Looking up the King James text…</p>';
    L.resolveRefs(text).then(function (list) {
      if (my !== refSeq) return;
      var bad = list.filter(function (r) { return !r.ok; }).length;
      box.innerHTML = '<p class="lx-lab">What Scripture says (KJV, exact) — members will see:</p>' + list.map(function (r) {
        if (!r.ok) return '<div class="lx-v bad"><p class="lx-vr bad">⚠ “' + esc(r.raw) + "” — " + esc(L.refProblem(r)) + '.</p><p class="lx-help">It will still be saved, but members will see only the reference “' + esc(r.label || r.raw) + "”, without the verse text.</p></div>";
        return '<div class="lx-v"><p class="lx-vr">' + esc(r.label) + ' ✓</p><p class="lx-vt">' + r.verses.map(function (x, i) {
          return (r.verses.length > 1 ? '<sup class="lx-vn">' + (x.v === 1 && i ? x.c + ":" : "") + x.v + "</sup>" : "") + esc(x.t);
        }).join(" ") + "</p></div>";
      }).join("") + (bad ? '<p class="lx-warn">Please check the reference' + (bad > 1 ? "s" : "") + ' marked ⚠ (for example “John 7:37-38”).</p>' : "");
    });
  }

  /* ---------- draft kept on this phone (Safari can reload the page while you're in the YouTube app) ---------- */
  function formData() {
    return { title: $("lxTitle").value, url: $("lxUrl").value, marker: $("lxMarker").value, summary: $("lxSummary").value, refs: $("lxRefs").value,
             editingId: editing ? editing.id : null, at: Date.now() };
  }
  function saveDraft() {
    var d = formData();
    if (d.title.trim() || d.url.trim() || d.summary.trim() || d.refs.trim()) LS.set(DRAFT, d); else LS.del(DRAFT);
  }
  function restoreDraft() {
    var d = LS.get(DRAFT, null);
    if (!d || Date.now() - (d.at || 0) > 14 * 86400e3) return false;
    if (d.editingId) { var r = rows.filter(function (x) { return x.id === d.editingId; })[0]; if (r) setEditing(r, true); }
    $("lxTitle").value = d.title || ""; $("lxUrl").value = d.url || ""; fillSelect(d.marker || ""); $("lxSummary").value = d.summary || ""; $("lxRefs").value = d.refs || "";
    if (d.url) checkUrl(true); if (d.refs) checkRefs();
    return true;
  }
  function clearForm() {
    editing = null; $("lxForm").reset(); fillSelect(""); LS.del(DRAFT);
    $("lxSave").textContent = "Save lesson"; $("lxCancel").hidden = true; $("lxH").textContent = "Add a lesson";
    $("lxPrev").hidden = true; $("lxVerses").innerHTML = ""; urlState = { error: "empty" }; checkUrl(false);
  }
  function setEditing(r, quiet) {
    editing = r;
    $("lxTitle").value = r.title || ""; $("lxUrl").value = r.youtube_url || ""; fillSelect(r.marker_id || "");
    $("lxSummary").value = r.summary || ""; $("lxRefs").value = r.verse_refs || "";
    $("lxSave").textContent = "Save changes"; $("lxCancel").hidden = false; $("lxH").textContent = "Edit lesson";
    checkUrl(true); checkRefs();
    if (!quiet) { say($("lxMsg"), "Editing “" + r.title + "”. Change anything, then tap Save changes."); $("lxAdmin").scrollIntoView({ block: "start", behavior: "smooth" }); }
  }

  /* ---------- save ---------- */
  function errText(e) {
    var m = String((e && (e.message || e.details || e.hint)) || (e && typeof e === "object" ? JSON.stringify(e) : e) || ""), code = String(e && e.code || "");
    if (L.isMissingTable(e)) return "The lessons list isn’t switched on yet: Ben needs to run one setup step in Supabase (migrations/2026-10-04_lessons.sql). Nothing was saved — what you typed is kept on this phone.";
    if (code === "42501" || /row-level security|permission denied/i.test(m)) return "Only group leaders can do this, and the database doesn’t list this email as one. Nothing was saved.";
    if (/AD30_NOT_SAVED/.test(m)) return "That didn’t save — the lesson may have been deleted. Reload the page and try again.";
    if (code === "23514" || /check constraint/i.test(m)) return "Something in the form isn’t allowed (for example a title that is too long). Nothing was saved.";
    if (/timeout|fetch|network|load failed/i.test(m)) return "Couldn’t reach the website’s database. Check your internet connection and tap Save again. What you typed is kept.";
    return "Couldn’t save: " + m;
  }
  function onSave(ev) {
    ev.preventDefault();
    var msg = $("lxMsg"), title = $("lxTitle").value.trim(), url = $("lxUrl").value.trim(), btn = $("lxSave");
    if (!title) { say(msg, "Please type a title.", "err"); $("lxTitle").focus(); return; }
    var y = L.parseYouTube(url);
    if (y.error) { checkUrl(true); say(msg, y.error === "empty" ? "Please paste the YouTube link." : "Please check the YouTube link (see the note under it).", "err"); $("lxUrl").focus(); return; }
    var dup = rows.filter(function (x) { return x.youtube_id === y.id && (!editing || x.id !== editing.id); })[0];
    if (dup && !confirm("This video is already on the site as “" + dup.title + "”. Add it again anyway? (Members only see it once.)")) return;
    var row = { title: title.slice(0, 200), youtube_url: url.slice(0, 500), youtube_id: y.id, marker_id: $("lxMarker").value || null,
                summary: $("lxSummary").value.trim() || null, verse_refs: $("lxRefs").value.trim() || null };
    if (row.marker_id && !L.validMarker(row.marker_id)) row.marker_id = null;
    btn.disabled = true; btn.textContent = "Saving…"; say(msg, "");
    var wasEditing = editing;
    L.save(row, wasEditing && wasEditing.id).then(function (r) {
      btn.disabled = false; btn.textContent = editing ? "Save changes" : "Save lesson";
      if (r.error) { say(msg, errText(r.error), "err"); if (L.isMissingTable(r.error)) showMissing(); return; }
      clearForm();
      say(msg, "Saved ✓ “" + r.data.title + "” " + (wasEditing ? "is updated on the site" : "is on the site now") + " — " + where(r.data.marker_id) +
        (r.data.published === false ? " (hidden from members until you tap Show)." : "."), "ok");
      msg.scrollIntoView({ block: "center", behavior: "smooth" });
      loadList();
    });
  }

  /* ---------- list: edit / hide-show / delete ---------- */
  function showMissing() {
    missing = true;
    $("lxListMsg").textContent = "Not switched on yet — the lessons table needs to be created in Supabase (run migrations/2026-10-04_lessons.sql in the SQL Editor). You can fill in the form, but saving won’t work until then.";
    $("lxListMsg").className = "hint lx-warn";
  }
  function loadList() {
    return L.fetch({ all: true, ms: 15000 }).then(function (res) {
      if (res.missing) { rows = []; showMissing(); paintList(); return; }
      if (res.error) { $("lxListMsg").textContent = "Couldn’t load the lessons just now (" + res.error + "). Reload the page to try again."; $("lxListMsg").className = "hint lx-warn"; return; }
      missing = false; rows = res.rows; $("lxListMsg").className = "hint";
      $("lxListMsg").textContent = rows.length ? "Newest first. “Hidden” lessons are only visible to group leaders." : "";
      paintList();
    });
  }
  function paintList() {
    var ul = $("lxItems"); ul.innerHTML = "";
    if (!rows.length) { if (!missing) ul.innerHTML = '<li class="lx-empty">No lessons yet — add the first one above.</li>'; return; }
    rows.forEach(function (r) {
      var li = document.createElement("li"), ok = L.validId(r.youtube_id);
      li.className = "lx-item" + (r.published ? "" : " hidden-l");
      li.innerHTML = '<div class="lx-item-top">' + (ok ? '<span class="lx-thumb"><img alt="" loading="lazy" src="' + esc(L.thumb(r.youtube_id)) + '"></span>' : "") +
        '<div><p class="lx-item-t">' + esc(r.title) + "</p>" +
        '<p class="lx-item-m">' + esc(where(r.marker_id)) + "</p>" +
        '<p class="lx-item-m">Added ' + esc(L.dateLabel(r.created_at)) + (r.created_by ? " by " + esc(r.created_by) : "") + (r.verse_refs ? " · " + esc(r.verse_refs) : "") + "</p>" +
        '<span class="lx-state ' + (r.published ? "on" : "off") + '">' + (r.published ? "Showing on the site" : "Hidden from members") + "</span>" +
        (ok ? "" : '<p class="lx-warn">This link has no playable video — tap Edit and paste the link again.</p>') +
        (r.published && ok ? '<br><a class="lx-view" href="./#v-' + esc(r.youtube_id) + '">View on the site →</a>' : "") + "</div></div>" +
        '<div class="lx-acts"><button type="button" data-a="edit">Edit</button><button type="button" data-a="vis">' + (r.published ? "Hide" : "Show") + '</button><button type="button" class="del" data-a="del">Delete</button></div>';
      li.querySelector('[data-a="edit"]').addEventListener("click", function () { setEditing(r); });
      li.querySelector('[data-a="vis"]').addEventListener("click", function (e) {
        var b = e.currentTarget; b.disabled = true;
        L.save({ published: !r.published }, r.id).then(function (res) {
          b.disabled = false;
          if (res.error) { alert(errText(res.error)); return; }
          say($("lxMsg"), "“" + r.title + "” is now " + (r.published ? "hidden from members." : "showing on the site."), "ok");
          loadList();
        });
      });
      li.querySelector('[data-a="del"]').addEventListener("click", function (e) {
        if (!confirm("Delete “" + r.title + "” from the site?\n\nThis can’t be undone. (The video stays on YouTube.)")) return;
        var b = e.currentTarget; b.disabled = true;
        L.remove(r.id).then(function (res) {
          b.disabled = false;
          if (res.error) { alert(errText(res.error)); return; }
          if (editing && editing.id === r.id) clearForm();
          say($("lxMsg"), "Deleted “" + r.title + "”.", "ok");
          loadList();
        });
      });
      ul.appendChild(li);
    });
  }

  /* ---------- start (called by admin.js after the admin check) ---------- */
  A.start = function () {
    if (started || !$("lxAdmin")) return; started = true;
    $("lxAdmin").hidden = false;
    fillSelect("");
    readMarkers().then(function () { fillSelect(); });
    var lazyUrl = debounce(function () { checkUrl(false); }, 350), lazyRefs = debounce(checkRefs, 450);
    $("lxUrl").addEventListener("input", function () { lazyUrl(); saveDraft(); });
    $("lxUrl").addEventListener("paste", function () { setTimeout(function () { checkUrl(true); saveDraft(); }, 30); });
    $("lxUrl").addEventListener("blur", function () { if ($("lxUrl").value.trim()) checkUrl(true); });
    $("lxRefs").addEventListener("input", function () { lazyRefs(); saveDraft(); });
    ["lxTitle", "lxSummary"].forEach(function (k) { $(k).addEventListener("input", saveDraft); });
    $("lxMarker").addEventListener("change", saveDraft);
    $("lxForm").addEventListener("submit", onSave);
    $("lxCancel").addEventListener("click", function () { clearForm(); say($("lxMsg"), "Editing cancelled — nothing was changed."); });
    if (navigator.clipboard && navigator.clipboard.readText && window.isSecureContext) {
      $("lxPaste").hidden = false;
      $("lxPaste").addEventListener("click", function () {
        navigator.clipboard.readText().then(function (t) { $("lxUrl").value = String(t || "").trim(); checkUrl(true); saveDraft(); },
          function () { setHelp($("lxUrlMsg"), "Press and hold in the box, then tap <b>Paste</b>.", "lx-help"); $("lxUrl").focus(); });
      });
    }
    loadList().then(function () { if (restoreDraft()) say($("lxMsg"), "We kept what you were typing earlier — it’s back in the form."); });
  };
  A._state = function () { return { rows: rows, editing: editing, markers: markers.length, missing: missing }; };
})();
