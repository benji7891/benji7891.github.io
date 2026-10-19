/* AD30 members - Admin page: edit a video's Study notes (PDF / link) right from the video card.      [pdf-edit-fix, new file]
   Sam could Edit a video, but the PDF that shows under it as Study notes had no Edit on the video card -
   its Edit button was only in the separate "PDFs & resources on the site" list far below.
   This adds, on every card in "Videos on the site":  📄 Study notes: <title>  [Edit study notes]
   which opens the same resource Edit form (title, link or file, note, timeline spot) used by that list.
   The Edit form also gets "Goes with lesson": pick a video and the PDF's title + timeline spot are set to match it,
   so it shows as that video's Study notes (same strict matching rule as the member page: exact title wins).
   Saving still goes through resources-admin.js (update on public.resources; RLS resources_admin_update). */
(function () {
  "use strict";
  var AD30 = window.AD30, L = window.AD30L, R = window.AD30R;
  if (!AD30 || !L || !R) return;
  var esc = AD30.esc, $ = function (id) { return document.getElementById(id); };
  function lessons() { try { return (window.AD30LA && AD30LA._state && AD30LA._state().rows) || []; } catch (e) { return []; } }
  function files() { try { return (window.AD30RA && AD30RA.rows && AD30RA.rows()) || []; } catch (e) { return []; } }
  function notesFor(l) { try { return R.lessonGuidesOf(files(), l, lessons()); } catch (e) { return []; } }
  function norm(t) { return String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

  /* ---------- video cards: show + edit their Study notes ---------- */
  function paintCards() {
    var ls = lessons();
    [].forEach.call(document.querySelectorAll("#lxItems > li[data-lid]"), function (li) {
      var old = li.querySelector(".ne-notes"); if (old) old.parentNode.removeChild(old);
      var l = ls.filter(function (x) { return String(x.id) === li.getAttribute("data-lid"); })[0]; if (!l) return;
      var n = notesFor(l), box = document.createElement("div"); box.className = "ne-notes";
      if (!n.length) { box.innerHTML = '<p class="lx-item-m">📄 No Study notes yet — add a PDF with the same title, or pick this video under “Goes with lesson” when editing a PDF.</p>'; }
      else n.forEach(function (r) {
        var row = document.createElement("div"); row.className = "ne-row";
        row.innerHTML = '<p class="lx-item-m">📄 Study notes: <b>' + esc(r.title) + "</b>" + (r.published === false ? " (hidden)" : "") + '</p><button type="button" class="ne-edit">Edit study notes</button>';
        row.querySelector("button").addEventListener("click", function () { if (window.AD30RA && AD30RA.edit) AD30RA.edit(r.id); });
        box.appendChild(row);
      });
      var acts = li.querySelector(".lx-acts"); li.insertBefore(box, acts || null);
    });
  }

  /* ---------- Edit form: "Goes with lesson" ---------- */
  function fillLessons(cur) {
    var sel = $("neLesson"); if (!sel) return;
    sel.innerHTML = '<option value="">— Not tied to a video —</option>';
    lessons().forEach(function (l) { var o = document.createElement("option"); o.value = l.id; o.textContent = l.title + " · " + (l.marker_id && L.marker(l.marker_id) ? L.markerLabel(L.marker(l.marker_id)) : "More lessons"); sel.appendChild(o); });
    sel.value = cur || "";
  }
  function onEdit(ev) {
    var r = ev.detail, box = $("neLessonBox"); if (!box) return;
    box.hidden = !r; if (!r) return;
    var ls = lessons(), cur = ls.filter(function (l) { return notesFor(l).some(function (x) { return String(x.id) === String(r.id); }); })[0];
    fillLessons(cur && cur.id);
    $("neLessonMsg").innerHTML = cur ? "Now showing as the Study notes of <b>" + esc(cur.title) + "</b>." : "Pick a video and this PDF becomes its <b>Study notes</b>: the title and timeline spot are set to match it.";
  }
  function onPick() {
    var id = $("neLesson").value, l = lessons().filter(function (x) { return String(x.id) === id; })[0];
    if (!l) { $("neLessonMsg").textContent = "Not tied to a video. It shows at its timeline spot (or under More lessons → Files)."; return; }
    $("rsTitle").value = l.title;
    var sel = $("rsMarker"), m = l.marker_id || "";
    if (m && !sel.querySelector('option[value="' + m.replace(/"/g, "") + '"]')) { var o = document.createElement("option"); o.value = m; o.textContent = m; sel.appendChild(o); }
    sel.value = m;
    $("neLessonMsg").innerHTML = "Title and timeline spot set to match <b>" + esc(l.title) + "</b>. Tap <b>Save changes</b>.";
  }
  function init() {
    document.addEventListener("ad30:rs-edit", onEdit);
    if ($("neLesson")) $("neLesson").addEventListener("change", onPick);
    var t = 0, again = function () { clearTimeout(t); t = setTimeout(paintCards, 50); };
    ["lxItems", "rsItems"].forEach(function (id) { var el = $(id); if (el && window.MutationObserver) new MutationObserver(again).observe(el, { childList: true }); });
    again();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  window.AD30NE = { _paint: paintCards, _norm: norm };
})();
