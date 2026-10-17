/* AD30 members - Admin page: put a lesson or a file on a timeline spot by DRAG-AND-DROP or "Move to…".      [timeline-v3, new file]
   Adds two buttons to every card in "Videos on the site" and "PDFs & resources on the site":
     ⠿ Drag    - press and drag (mouse, or finger on iPhone) onto a spot in the timeline outline that opens
     Move to…  - tap, then tap a spot (the same outline; easiest on a phone)
   The outline = "More lessons (no timeline date)" + every category and spot of the "Timeline spot" menu (same list).
   Saving uses the same database calls as the Edit forms (lessons: AD30L.save; resources: update of marker_id),
   which the database allows for Admins only (RLS: lessons_admin_update, resources_admin_update). The menus are unchanged.
   Moving a lesson also moves its Study notes file (the one that shows under it on the member page), unless unticked.
   Text from the database is always escaped. */
(function () {
  "use strict";
  var AD30 = window.AD30, L = window.AD30L, R = window.AD30R;
  if (!AD30 || !L) return;
  var esc = AD30.esc, $ = function (id) { return document.getElementById(id); };
  var MORE = "More lessons (no timeline date)";
  var sheet = null, cur = null, toastT = 0, lastUndo = null;

  function lessonRows() { try { return (window.AD30LA && AD30LA._state && AD30LA._state().rows) || []; } catch (e) { return []; } }
  function resRows() { try { return (window.AD30RA && AD30RA.rows && AD30RA.rows()) || []; } catch (e) { return []; } }
  function find(kind, id) { var l = kind === "lesson" ? lessonRows() : resRows(); for (var i = 0; i < l.length; i++) if (String(l[i].id) === String(id)) return l[i]; return null; }
  function label(id) { if (!id) return MORE; var m = L.marker(id); return m ? L.markerLabel(m) : "Timeline spot “" + id + "”"; }
  function notesFor(lesson) {
    if (!R || !R.lessonGuidesOf) return [];
    try { return R.lessonGuidesOf(resRows(), lesson, lessonRows()); } catch (e) { return []; }   // [notes-match-fix] same strict rule as the member page
  }

  /* ---------- saving ---------- */
  function saveOne(kind, row, marker) {
    if (kind === "lesson") return L.save({ marker_id: marker }, row.id).then(function (r) { if (r.error) throw r.error; return r; });
    if (AD30.demo || !AD30.sb) { row.marker_id = marker; return Promise.resolve({}); }   // demo / preview: nothing is sent
    return R.timeout(AD30.sb.from("resources").update({ marker_id: marker }).eq("id", row.id).select("id,marker_id"), 15000).then(function (r) {
      if (r.error || !r.data || !r.data.length) throw r.error || { message: "Nothing changed. The database may not allow edits yet (migrations/2026-10-16_resources_edit.sql)." };
      return r;
    });
  }
  function move(kind, row, marker, withNotes) {
    if (marker && !L.validMarker(marker)) return;
    if ((row.marker_id || null) === (marker || null)) { toast("“" + row.title + "” is already at " + label(marker) + "."); return; }
    var jobs = [{ kind: kind, row: row, from: row.marker_id || null }];
    if (kind === "lesson" && withNotes) notesFor(row).forEach(function (r) { if ((r.marker_id || null) !== (marker || null)) jobs.push({ kind: "resource", row: r, from: r.marker_id || null }); });
    toast("Saving…");
    return run(jobs, marker || null).then(function () {
      lastUndo = jobs;
      toast("Moved “" + row.title + "”" + (jobs.length > 1 ? " and its Study notes" : "") + " to " + label(marker) + ".", true);
    }, function (e) {
      toast("That didn’t save: " + (/42501|row-level|permission/i.test(String((e && (e.message || e.code)) || e)) ? "this email isn’t on the database’s Admin list." : String((e && (e.message || e.code)) || e)));
    }).then(reload);
  }
  function run(jobs, marker) {
    return jobs.reduce(function (p, j) { return p.then(function () { return saveOne(j.kind, j.row, marker === undefined ? j.from : marker); }); }, Promise.resolve());
  }
  function undo() {
    var jobs = lastUndo; lastUndo = null; if (!jobs) return;
    toast("Undoing…");
    jobs.reduce(function (p, j) { return p.then(function () { return saveOne(j.kind, j.row, j.from); }); }, Promise.resolve())
      .then(function () { toast("Undone — back where it was."); }, function (e) { toast("Couldn’t undo: " + String((e && e.message) || e)); }).then(reload);
  }
  function reload() {
    if (window.AD30LA && AD30LA.reload) AD30LA.reload();
    if (window.AD30RA && AD30RA.reload) AD30RA.reload();
  }
  function toast(text, canUndo) {
    var t = $("tpToast");
    if (!t) { t = document.createElement("div"); t.id = "tpToast"; t.className = "tp-toast"; t.setAttribute("role", "status"); t.setAttribute("aria-live", "polite"); document.body.appendChild(t); }
    t.innerHTML = esc(text) + (canUndo ? ' <button type="button" class="tp-undo">Undo</button>' : "");
    if (canUndo) t.querySelector(".tp-undo").addEventListener("click", undo);
    t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, canUndo ? 9000 : 6000);
  }

  /* ---------- the outline (sheet) ---------- */
  function outlineHTML(curMarker) {
    var h = '<button type="button" class="tp-spot tp-more" data-spot="">' + '<b>' + esc(MORE) + "</b>" + (curMarker ? "" : '<span class="tp-now">here now</span>') + "</button>";
    var grp = null;
    (L.MARKERS || []).forEach(function (m) {
      if (m.sec !== grp) { if (grp !== null) h += "</div>"; grp = m.sec; h += '<h4 class="tp-grp">' + esc(m.sec) + '</h4><div class="tp-gl">'; }
      h += '<button type="button" class="tp-spot" data-spot="' + esc(m.id) + '"><small>' + esc(L.shortDate(m.dt)) + "</small><span>" + esc(m.ttl) + "</span>" +
        (curMarker === m.id ? '<span class="tp-now">here now</span>' : "") + "</button>";
    });
    if (grp !== null) h += "</div>";
    return h;
  }
  function openSheet(kind, row, dragging) {
    closeSheet();
    cur = { kind: kind, row: row };
    var notes = kind === "lesson" ? notesFor(row) : [];
    sheet = document.createElement("div");
    sheet.className = "tp-sheet" + (dragging ? " tp-dragging" : "");
    sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-modal", dragging ? "false" : "true"); sheet.setAttribute("aria-labelledby", "tpH");
    sheet.innerHTML = '<div class="tp-card">' +
      '<div class="tp-head"><h3 id="tpH" class="serif">' + (dragging ? "Drop on a spot" : "Move to…") + '</h3><button type="button" class="tp-x" aria-label="Close">✕</button></div>' +
      '<p class="tp-what">' + (kind === "lesson" ? "Video" : "File") + ": <b>" + esc(row.title) + "</b><br><span>Now: " + esc(label(row.marker_id)) + "</span></p>" +
      (notes.length ? '<label class="tp-notes"><input type="checkbox" checked> Also move its Study notes: “' + esc(notes.map(function (n) { return n.title; }).join("”, “")) + "”</label>" : "") +
      '<div class="tp-list">' + outlineHTML(row.marker_id || null) + "</div></div>";
    document.body.appendChild(sheet);
    document.documentElement.classList.add("tp-open");
    sheet.querySelector(".tp-x").addEventListener("click", closeSheet);
    sheet.addEventListener("click", function (e) { if (e.target === sheet && !dragging) closeSheet(); });
    [].forEach.call(sheet.querySelectorAll(".tp-spot"), function (b) {
      b.addEventListener("click", function () { if (sheet.classList.contains("tp-dragging")) return; pick(b.getAttribute("data-spot")); });
    });
    var now = sheet.querySelector(".tp-now"); if (now && !dragging) { var sp = now.closest(".tp-spot"); setTimeout(function () { sp.scrollIntoView({ block: "center" }); sp.focus(); }, 0); }
    else sheet.querySelector(".tp-x").focus();
    return sheet;
  }
  function withNotes() { var c = sheet && sheet.querySelector(".tp-notes input"); return !c || c.checked; }
  function pick(spot) { var c = cur, n = withNotes(); closeSheet(); if (c) move(c.kind, c.row, spot || null, n); }
  function closeSheet() {
    if (sheet && sheet.parentNode) sheet.parentNode.removeChild(sheet);
    sheet = null; cur = null; document.documentElement.classList.remove("tp-open");
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && sheet) { endDrag(true); closeSheet(); } });

  /* ---------- drag (pointer events: mouse, pen and touch) ---------- */
  var drag = null;
  function startDrag(e, kind, row, handle) {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    drag = { kind: kind, row: row, x: e.clientX, y: e.clientY, on: false, id: e.pointerId, handle: handle, over: null, raf: 0 };
    try { handle.setPointerCapture(e.pointerId); } catch (x) {}
  }
  function moveDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.on) {
      if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) < 6) return;
      drag.on = true;
      openSheet(drag.kind, drag.row, true);
      var g = document.createElement("div"); g.className = "tp-ghost"; g.textContent = drag.row.title; document.body.appendChild(g); drag.ghost = g;
    }
    e.preventDefault();
    drag.cx = e.clientX; drag.cy = e.clientY;
    drag.ghost.style.transform = "translate(" + (e.clientX + 12) + "px," + (e.clientY - 18) + "px)";
    var el = document.elementFromPoint(e.clientX, e.clientY), t = el && el.closest ? el.closest(".tp-spot") : null;
    if (t !== drag.over) { if (drag.over) drag.over.classList.remove("tp-over"); drag.over = t; if (t) t.classList.add("tp-over"); }
    autoScroll();
  }
  function autoScroll() {
    if (!drag || !drag.on || !sheet) return;
    cancelAnimationFrame(drag.raf);
    var list = sheet.querySelector(".tp-list"), r = list.getBoundingClientRect(), y = drag.cy, edge = 60, v = 0;
    if (y < r.top + edge) v = -Math.ceil((r.top + edge - y) / 4); else if (y > r.bottom - edge) v = Math.ceil((y - (r.bottom - edge)) / 4);
    if (!v) return;
    list.scrollTop += v;
    drag.raf = requestAnimationFrame(function () {
      var el = document.elementFromPoint(drag.cx, drag.cy), t = el && el.closest ? el.closest(".tp-spot") : null;
      if (t !== drag.over) { if (drag.over) drag.over.classList.remove("tp-over"); drag.over = t; if (t) t.classList.add("tp-over"); }
      autoScroll();
    });
  }
  function endDrag(cancel) {
    if (!drag) return null;
    var d = drag; drag = null; cancelAnimationFrame(d.raf);
    try { d.handle.releasePointerCapture(d.id); } catch (x) {}
    if (d.ghost && d.ghost.parentNode) d.ghost.parentNode.removeChild(d.ghost);
    if (!d.on) { if (!cancel) openSheet(d.kind, d.row, false); return null; }   // a tap on ⠿ = same as Move to…
    var t = cancel ? null : d.over;
    if (!t) { if (sheet) { sheet.classList.remove("tp-dragging"); sheet.querySelector("#tpH").textContent = "Move to…"; sheet.setAttribute("aria-modal", "true"); } return null; }   // dropped outside: keep the list open to tap
    pick(t.getAttribute("data-spot"));
    return t;
  }
  document.addEventListener("pointermove", moveDrag, { passive: false });
  document.addEventListener("pointerup", function (e) { if (drag && e.pointerId === drag.id) endDrag(false); });
  document.addEventListener("pointercancel", function (e) { if (drag && e.pointerId === drag.id) endDrag(true); });

  /* ---------- buttons on each card ---------- */
  function addButtons(li, kind, id) {
    if (!li || li._tp) return;
    var acts = li.querySelector(".lx-acts"); if (!acts) return;
    li._tp = true;
    var row = find(kind, id); if (!row) return;
    var d = document.createElement("button"); d.type = "button"; d.className = "tp-drag"; d.innerHTML = '<span aria-hidden="true">⠿</span> Drag';
    d.setAttribute("aria-label", "Drag “" + row.title + "” to a timeline spot (or tap for the list)");
    var m = document.createElement("button"); m.type = "button"; m.className = "tp-move"; m.textContent = "Move to…";
    acts.insertBefore(m, acts.firstChild); acts.insertBefore(d, acts.firstChild);
    d.addEventListener("pointerdown", function (e) { var r = find(kind, id); if (r) startDrag(e, kind, r, d); });
    d.addEventListener("click", function (e) { e.preventDefault(); });   // the tap is handled on pointerup
    d.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); var r = find(kind, id); if (r) openSheet(kind, r, false); } });
    m.addEventListener("click", function () { var r = find(kind, id); if (r) openSheet(kind, r, false); });
  }
  function scan() {
    [].forEach.call(document.querySelectorAll("#lxItems > li[data-lid]"), function (li) { addButtons(li, "lesson", li.getAttribute("data-lid")); });
    [].forEach.call(document.querySelectorAll("#rsItems > li[data-rs]"), function (li) { addButtons(li, "resource", li.getAttribute("data-rs")); });
  }
  function watch(id) { var el = $(id); if (el && window.MutationObserver) new MutationObserver(scan).observe(el, { childList: true }); }
  function init() { watch("lxItems"); watch("rsItems"); scan(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  window.AD30TP = { open: function (kind, id) { var r = find(kind, id); if (r) openSheet(kind, r, false); }, _move: move };
})();
