/* [edit-tabs] Admin "Edit a tab": leaders change any member-view tab without code.
   Saves one JSON row per tab in public.section_overrides (js/section-overrides.js); the built-in text in
   js/simple-data.js is never changed, so "Back to the original" always works. */
(function () {
  "use strict";
  var AD30 = window.AD30, esc = AD30.esc, SO = window.AD30SO, L = window.AD30L || {};
  var $ = function (id) { return document.getElementById(id); };
  var DATA = (window.AD30_SIMPLE || { sections: [] }).sections;
  var PART_NAMES = { description: "Short description", videos: "Built-in video", scripture: "What Scripture says (KJV)", spots: "Timeline spots & lessons", notes: "Section notes button" };
  // same marker -> tab rules as js/lessons-member.js (kept in step by hand)
  var GROUPS = [["Before the ministry", "birth"], ["Two men turn thirty", "jordan"], ["First Passover", "jordan"],
    ["The final twelve months", "tabernacles"], ["The final week", "passover"], ["Forty days", "pentecost"]];
  function tabFor(m) {
    for (var i = 0; i < DATA.length; i++) if ((DATA[i].timelineIds || []).indexOf(m.id) >= 0) return DATA[i].id;
    if (L.MEMBER_MAP && L.MEMBER_MAP[m.id]) return L.MEMBER_MAP[m.id];
    var EX = { herod: "birth", pilate: "jordan", john30: "jordan", jn1: "jordan", pass27: "jordan", jn435: "jordan", jn51: "jordan", pass28: "jordan",
      pass29: "tabernacles", bday33: "tabernacles", ded29: "tabernacles", fig: "tabernacles", jn1155: "passover", jn121: "passover", entry: "passover", n10: "passover", jn2026: "resurrection" };
    if (EX[m.id]) return EX[m.id];
    for (i = 0; i < GROUPS.length; i++) if (String(m.sec).indexOf(GROUPS[i][0]) === 0) return GROUPS[i][1];
    return null;
  }
  var cur = null, st = null, started = false;
  function base(id) { for (var i = 0; i < DATA.length; i++) if (DATA[i].id === id) return DATA[i]; return null; }
  function spotsOf(id) { return (L.MARKERS || []).filter(function (m) { return tabFor(m) === id; }); }

  function load(id) {
    cur = id; var b = base(id), o = JSON.parse(JSON.stringify(SO.get(id)));
    var eff = SO.apply(b);
    st = {
      title: eff.title, date: eff.date || "", dateNote: eff.dateNote || "", description: eff.description || "",
      verses: (eff.verses || []).map(function (v) { return { ref: v.ref, text: v.text }; }),
      notesText: o.notesText || "", hideTeaching: !!o.hideTeaching,
      show: { date: SO.shown(eff, "date"), description: SO.shown(eff, "description"), videos: SO.shown(eff, "videos"), scripture: SO.shown(eff, "scripture"),
              spots: SO.shown(eff, "spots"), timelineHeading: SO.shown(eff, "timelineHeading"), notes: SO.shown(eff, "notes") },
      hideLessonScripture: !!eff.hideLessonScripture, order: (eff.order && eff.order.length ? eff.order : SO.PARTS.slice()),
      tabHidden: !!o.tabHidden, pos: o.pos || "",
      spots: [], verseChanged: Array.isArray(o.verses)
    };
    SO.PARTS.forEach(function (p) { if (st.order.indexOf(p) < 0) st.order.push(p); });
    var all = spotsOf(id), so = o.spotOrder || [];
    all.forEach(function (m) {
      var x = (o.spots || {})[m.id] || {};
      st.spots.push({ id: m.id, origT: m.ttl, origD: m.dt, title: x.title || "", date: x.date || "", hidden: !!x.hidden,
        hideHeading: !!x.hideHeading });
    });
    if (so.length) st.spots.sort(function (a, c) { var ra = so.indexOf(a.id), rc = so.indexOf(c.id); return (ra < 0 ? 1e6 : ra) - (rc < 0 ? 1e6 : rc); });
    draw(); msg("");
  }
  function msg(t, bad) { var m = $("teMsg"); m.textContent = t; m.className = "te-msg" + (bad ? " bad" : t ? " ok" : ""); }
  function chk(key, label, on) { return '<label class="te-chk"><input type="checkbox" data-show="' + key + '"' + (on ? " checked" : "") + '> ' + esc(label) + '</label>'; }
  function updn(kind, i, n) {
    return '<span class="te-ud"><button type="button" class="te-mini" data-up="' + kind + '" data-i="' + i + '"' + (i ? "" : " disabled") + ' aria-label="Move up">↑</button>' +
      '<button type="button" class="te-mini" data-dn="' + kind + '" data-i="' + i + '"' + (i < n - 1 ? "" : " disabled") + ' aria-label="Move down">↓</button></span>';
  }
  function draw() {
    var h = "";
    h += '<details class="te-g" open><summary>Title &amp; date</summary>' +
      '<label class="te-l" for="teTitle">Tab title</label><input class="te-in" id="teTitle" data-f="title" value="' + esc(st.title) + '">' +
      '<label class="te-l" for="teDate">Date line</label><input class="te-in" id="teDate" data-f="date" value="' + esc(st.date) + '" placeholder="e.g. Mon Oct 17, AD 29">' +
      '<label class="te-l" for="teDN">After the date (where it comes from)</label><input class="te-in" id="teDN" data-f="dateNote" value="' + esc(st.dateNote) + '">' +
      '<label class="te-l" for="teDesc">Short description</label><textarea class="te-in" id="teDesc" rows="3" data-f="description">' + esc(st.description) + '</textarea></details>';
    h += '<details class="te-g" open><summary>Show or hide</summary>' +
      chk("date", "Date line", st.show.date) + chk("description", "Short description", st.show.description) + chk("videos", "Built-in video", st.show.videos) +
      chk("scripture", "“What Scripture says (KJV)” box", st.show.scripture) + chk("spots", "Timeline spots & lessons", st.show.spots) +
      chk("timelineHeading", "“On the timeline” heading", st.show.timelineHeading) + chk("notes", "Section notes button", st.show.notes) +
      '<label class="te-chk"><input type="checkbox" id="teLS"' + (st.hideLessonScripture ? "" : " checked") + '> KJV verse box on each lesson</label>' +
      '<label class="te-chk te-warn"><input type="checkbox" id="teHide"' + (st.tabHidden ? " checked" : "") + '> Hide this whole tab from members</label></details>';
    h += '<details class="te-g"><summary>Order inside the tab</summary><ol class="te-list">' + st.order.map(function (p, i) {
      return '<li class="te-row"><span class="te-rt">' + esc(PART_NAMES[p]) + '</span>' + updn("order", i, st.order.length) + '</li>'; }).join("") +
      '</ol><label class="te-l" for="tePos">Place in the tab list (1 = first; blank = normal)</label><input class="te-in te-num" id="tePos" inputmode="numeric" value="' + esc(st.pos) + '"></details>';
    h += '<details class="te-g"><summary>Scripture verses (' + st.verses.length + ')</summary><p class="te-hint">Type the KJV text exactly. These also show in Section notes.</p>' +
      st.verses.map(function (v, i) {
        return '<div class="te-card"><div class="te-ch">Verse ' + (i + 1) + updn("verse", i, st.verses.length) + '<button type="button" class="te-mini te-x" data-del="' + i + '">Remove</button></div>' +
          '<input class="te-in" data-v="' + i + '" data-k="ref" value="' + esc(v.ref) + '" placeholder="John 7:37" aria-label="Reference">' +
          '<textarea class="te-in" rows="3" data-v="' + i + '" data-k="text" aria-label="Verse text">' + esc(v.text) + '</textarea></div>'; }).join("") +
      '<button type="button" class="te-btn2" id="teAddV">+ Add a verse</button></details>';
    h += '<details class="te-g"><summary>Section notes</summary><label class="te-l" for="teNotes">Your notes (shown at the top of Section notes)</label>' +
      '<textarea class="te-in" id="teNotes" rows="5" data-f="notesText" placeholder="Leave a blank line between paragraphs">' + esc(st.notesText) + '</textarea>' +
      '<label class="te-chk"><input type="checkbox" id="teTeach"' + (st.hideTeaching ? "" : " checked") + '> Keep the built-in Teaching list</label></details>';
    h += '<details class="te-g"><summary>Timeline spots (' + st.spots.length + ')</summary><p class="te-hint">Blank title or date = keep the original (shown in grey). “Hide spot” also hides the lessons placed on it, in this tab only.</p>' +
      st.spots.map(function (s, i) {
        return '<div class="te-card' + (s.hidden ? " te-off" : "") + '"><div class="te-ch">Spot ' + (i + 1) + updn("spot", i, st.spots.length) + '</div>' +
          '<input class="te-in" data-s="' + i + '" data-k="date" value="' + esc(s.date) + '" placeholder="' + esc(s.origD) + '" aria-label="Spot date">' +
          '<input class="te-in" data-s="' + i + '" data-k="title" value="' + esc(s.title) + '" placeholder="' + esc(s.origT) + '" aria-label="Spot title">' +
          '<label class="te-chk"><input type="checkbox" data-s="' + i + '" data-k="hideHeading"' + (s.hideHeading ? " checked" : "") + '> Hide date &amp; title (lessons still show)</label>' +
          '<label class="te-chk"><input type="checkbox" data-s="' + i + '" data-k="hidden"' + (s.hidden ? " checked" : "") + '> Hide spot</label></div>'; }).join("") + '</details>';
    $("teBody").innerHTML = h;
  }
  function swap(a, i, j) { var t = a[i]; a[i] = a[j]; a[j] = t; }
  function onInput(e) {
    var t = e.target, k = t.getAttribute("data-k");
    if (t.hasAttribute("data-f")) st[t.getAttribute("data-f")] = t.value;
    else if (t.hasAttribute("data-show")) st.show[t.getAttribute("data-show")] = t.checked;
    else if (t.hasAttribute("data-v")) { st.verses[+t.getAttribute("data-v")][k] = t.value; st.verseChanged = true; }
    else if (t.hasAttribute("data-s")) { var s = st.spots[+t.getAttribute("data-s")]; s[k] = t.type === "checkbox" ? t.checked : t.value; if (k === "hidden") t.closest(".te-card").classList.toggle("te-off", t.checked); }
    else if (t.id === "teLS") st.hideLessonScripture = !t.checked;
    else if (t.id === "teHide") st.tabHidden = t.checked;
    else if (t.id === "teTeach") st.hideTeaching = !t.checked;
    else if (t.id === "tePos") st.pos = t.value.replace(/\D/g, "");
    msg("Not saved yet");
  }
  function onClick(e) {
    var b = e.target.closest("button"); if (!b) return;
    var i = +b.getAttribute("data-i"), kind = b.getAttribute("data-up") || b.getAttribute("data-dn"), d = b.hasAttribute("data-up") ? -1 : 1;
    var arr = kind === "order" ? st.order : kind === "verse" ? st.verses : kind === "spot" ? st.spots : null;
    if (arr) { swap(arr, i, i + d); if (kind === "verse") st.verseChanged = true; if (kind === "spot") st.spotMoved = true; if (kind === "order") st.orderMoved = true; keepOpen(draw); msg("Not saved yet"); return; }
    if (b.hasAttribute("data-del")) { st.verses.splice(+b.getAttribute("data-del"), 1); st.verseChanged = true; keepOpen(draw); msg("Not saved yet"); return; }
    if (b.id === "teAddV") { st.verses.push({ ref: "", text: "" }); st.verseChanged = true; keepOpen(draw); var ins = $("teBody").querySelectorAll('[data-k="ref"]'); if (ins.length) ins[ins.length - 1].focus(); }
  }
  function keepOpen(fn) {
    var open = [].map.call($("teBody").querySelectorAll("details"), function (d) { return d.open; }), y = window.scrollY;
    fn(); [].forEach.call($("teBody").querySelectorAll("details"), function (d, i) { if (i in open) d.open = open[i]; }); window.scrollTo(0, y);
  }
  // only what differs from the built-in text is stored
  function content() {
    var b = base(cur), c = {}, def = SO.apply(Object.assign({}, b, { id: "__none__" }));
    ["title", "date", "dateNote", "description"].forEach(function (k) { if ((st[k] || "") !== (b[k] || "")) c[k] = st[k]; });
    if (st.verseChanged) c.verses = st.verses.filter(function (v) { return v.ref.trim() || v.text.trim(); });
    if (st.notesText.trim()) c.notesText = st.notesText;
    if (st.hideTeaching) c.hideTeaching = true;
    var sh = {}; Object.keys(st.show).forEach(function (k) {
      var was = SO.shown(def, k); if (st.show[k] !== was) sh[k] = st.show[k]; });
    if (Object.keys(sh).length) c.show = sh;
    if (st.orderMoved && st.order.join() !== SO.PARTS.join()) c.order = st.order;
    if (st.hideLessonScripture !== !!b.hideLessonScripture) c.hideLessonScripture = st.hideLessonScripture;
    var sp = {}; st.spots.forEach(function (s) {
      var x = {};
      if (s.title.trim()) x.title = s.title.trim(); if (s.date.trim()) x.date = s.date.trim(); if (s.hidden) x.hidden = true;
      if (s.hideHeading) x.hideHeading = true;
      if (Object.keys(x).length) sp[s.id] = x; });
    if (Object.keys(sp).length) c.spots = sp;
    if (st.spotMoved || (SO.get(cur).spotOrder)) c.spotOrder = st.spots.map(function (s) { return s.id; });
    if (st.tabHidden) c.tabHidden = true;
    if (st.pos) c.pos = +st.pos;
    return c;
  }
  function save(c, done) {
    var btn = $("teSave"); btn.disabled = true; msg("Saving…");
    SO.save(cur, c).then(function (r) {
      btn.disabled = false;
      if (r && r.error) {
        var m = r.error.message || "";
        msg(/section_overrides|relation|schema cache|42P01|PGRST205/i.test(m + (r.error.code || "")) ? "Can’t save yet: the tab-edits table hasn’t been added to the database." :
            /row-level|permission|42501/i.test(m + (r.error.code || "")) ? "Can’t save: this email isn’t on the admin list." : "Couldn’t save — " + m, true);
        return;
      }
      msg(done || "Saved ✓ Members see it next time they open the page.");
    }, function () { btn.disabled = false; msg("Couldn’t save — check your connection and try again.", true); });
  }
  function fillPicker() {
    $("tePick").innerHTML = DATA.map(function (s) { var e = Object.keys(SO.get(s.id)).length; return '<option value="' + esc(s.id) + '">' + esc(SO.apply(s).title) + (e ? " (edited)" : "") + '</option>'; }).join("");
  }
  var TE = (window.AD30TE = {});
  TE.start = function () {
    if (started || !$("teAdmin")) return; started = true;
    $("teAdmin").hidden = false;
    SO.load().then(function () { fillPicker(); if (DATA.length) { $("tePick").value = cur || DATA[0].id; load($("tePick").value); } });
    $("tePick").addEventListener("change", function () { load(this.value); });
    $("teBody").addEventListener("input", onInput); $("teBody").addEventListener("change", onInput); $("teBody").addEventListener("click", onClick);
    $("teSave").addEventListener("click", function () { save(content()); var v = cur; setTimeout(function () { fillPicker(); $("tePick").value = v; }, 300); });
    $("teReset").addEventListener("click", function () {
      if (!confirm("Put “" + base(cur).title + "” back to the original? Your edits to this tab will be cleared.")) return;
      save({}, "Back to the original ✓"); setTimeout(function () { fillPicker(); $("tePick").value = cur; load(cur); }, 300);
    });
    $("teView").addEventListener("click", function () { window.open("simple.html" + (AD30.demo ? "?demo=1&as=member" : "") + "#" + cur, "_blank"); });
  };
})();
