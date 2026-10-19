/* [edit-tabs] Leader edits for each member-view tab, saved in the Supabase table public.section_overrides
   (one row per tab id: content = JSON). Member pages lay these over the built-in js/simple-data.js text.
   If the table doesn't exist yet, can't be read, or a row is empty, the built-in text shows exactly as before.
   content keys (all optional):
     title, date, dateNote, description            text; "" = blank
     verses: [{ref, text}]                          replaces the "What Scripture says (KJV)" verses (and Section notes)
     notesText                                      extra Section-notes text (plain; blank lines = paragraphs)
     hideTeaching                                   true = drop the built-in Teaching list from Section notes
     show: {date, description, videos, scripture, spots, timelineHeading, notes}   false = hide that part
     order: ["description","videos","scripture","spots","notes"]                    order of parts inside the tab
     hideLessonScripture                            true = no KJV box on the lessons in this tab
     spots: { <spotId>: {title, date, hidden, hideHeading} }   spotOrder: [spotId, ...]
     tabHidden, pos                                 hide the whole tab / its place in the list (1 = first) */
(function () {
  "use strict";
  var AD30 = window.AD30 || {}, KEY = "ad30m.tabEdits", DEMO_KEY = "ad30m.demoTabEdits";
  var SO = (window.AD30SO = { map: {}, PARTS: ["description", "videos", "scripture", "spots", "notes"] });
  function readLS(k) { try { return JSON.parse(localStorage.getItem(k) || "{}") || {}; } catch (e) { return {}; } }
  function writeLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  SO.map = readLS(AD30.demo ? DEMO_KEY : KEY);   // last good copy -> first paint already has the edits

  SO.load = function () {
    if (AD30.demo) { SO.map = readLS(DEMO_KEY); return Promise.resolve(SO.map); }
    if (!AD30.sb) return Promise.resolve(SO.map);
    return AD30.sb.from("section_overrides").select("section_id,content").then(function (r) {
      if (r.error) { if (window.console) console.info("[edit-tabs] no tab edits (" + (r.error.code || r.error.message) + ")"); return SO.map; }
      var m = {}; (r.data || []).forEach(function (x) { if (x && x.section_id && x.content && typeof x.content === "object") m[x.section_id] = x.content; });
      SO.map = m; writeLS(KEY, m); return m;
    }, function () { return SO.map; });
  };
  SO.save = function (id, content) {
    if (AD30.demo) { var m = readLS(DEMO_KEY); m[id] = content; writeLS(DEMO_KEY, m); SO.map = m; return Promise.resolve({}); }
    if (!AD30.sb) return Promise.resolve({ error: { message: "Not connected" } });
    return AD30.sb.from("section_overrides").upsert({ section_id: id, content: content, updated_at: new Date().toISOString() }, { onConflict: "section_id" })
      .then(function (r) { if (!r.error) { SO.map[id] = content; writeLS(KEY, SO.map); } return r; });
  };
  SO.get = function (id) { var o = SO.map[id]; return o && typeof o === "object" ? o : {}; };
  function str(v) { return typeof v === "string"; }

  // a copy of the built-in section with the leader's edits laid over it
  SO.apply = function (s) {
    var o = SO.get(s.id), c = Object.assign({}, s);
    ["title", "date", "dateNote", "description"].forEach(function (k) { if (str(o[k])) c[k] = o[k]; });
    if (str(o.title) && !o.title.trim()) c.title = s.title;   // a tab always keeps a name
    if (Array.isArray(o.verses)) c.verses = o.verses.filter(function (v) { return v && (v.ref || v.text); })
      .map(function (v) { return { ref: String(v.ref || ""), text: String(v.text || "") }; });
    if (o.hideTeaching) c.teaching = [];
    if (str(o.notesText)) c.notesText = o.notesText;
    c.show = Object.assign({}, o.show || {});
    c.order = Array.isArray(o.order) ? o.order.filter(function (p) { return SO.PARTS.indexOf(p) >= 0; }) : null;
    if ("hideLessonScripture" in o) c.hideLessonScripture = !!o.hideLessonScripture;
    c.spotEdits = o.spots && typeof o.spots === "object" ? o.spots : {};
    c.spotOrder = Array.isArray(o.spotOrder) ? o.spotOrder : null;
    c.tabHidden = !!o.tabHidden; c.pos = typeof o.pos === "number" ? o.pos : null;
    c.edited = Object.keys(o).length > 0;
    return c;
  };
  SO.shown = function (s, part) { return !(s.show && s.show[part] === false); };
  // tab list order: tabs with a "pos" move to that place; hidden tabs are dropped
  SO.arrange = function (list) {
    var keep = list.filter(function (s) { return !s.tabHidden; }), out = keep.filter(function (s) { return s.pos == null || s.extra; });
    keep.filter(function (s) { return s.pos != null && !s.extra; }).sort(function (a, b) { return a.pos - b.pos; })
      .forEach(function (s) { out.splice(Math.max(0, Math.min(out.length, s.pos - 1)), 0, s); });
    return out;
  };
  // timeline spots of a tab, with edits: renamed/redated, hidden ones dropped, leader's order first
  SO.spots = function (s, spots) {
    var e = (s && s.spotEdits) || {}, out = [];
    spots.forEach(function (m) {
      var x = e[m.id] || {}; if (x.hidden) return;
      var c = Object.assign({}, m);
      if (str(x.title) && x.title.trim()) c.ttl = x.title;
      if (str(x.date) && x.date.trim()) { c.dt = x.date; c.dtLiteral = true; }
      c.hideHeading = !!x.hideHeading; out.push(c);
    });
    if (s && s.spotOrder) {
      var rank = function (m) { var i = s.spotOrder.indexOf(m.id); return i < 0 ? 1e6 : i; };
      out = out.map(function (m, i) { return [m, i]; }).sort(function (a, b) { return (rank(a[0]) - rank(b[0])) || (a[1] - b[1]); }).map(function (p) { return p[0]; });
    }
    return out;
  };
})();
