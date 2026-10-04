/* AD30 members - MEMBER VIEW (simple.html).                                         [simple-rework, new file]
   Replaces js/app.js on simple.html. What members see:
     * the countdown (unchanged),
     * a list of big section titles in date order; tapping one opens it (one at a time) to show a short
       description, the video (if the section has one), the key KJV verses, and a "Study notes" button,
     * Study notes: a clean, large-print read-along page for a section (or all sections) with Print.
   Kept from app.js: sign-in gate, free-window check, account box (new-video emails, sign out),
   videos from the Google Sheet, watched marks, share, engagement logging, Add-to-Home-Screen tip.
   Content comes from js/simple-data.js (generated from the site; teacher-only notes are not in it).
   Plain ES5 so it runs on older iPhones without a build step. */
(function () {
  "use strict";
  var AD30 = window.AD30, $ = AD30.$, LS = AD30.LS, esc = AD30.esc;
  var DATA = window.AD30_SIMPLE || { sections: [] };
  var RM = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  var started = false;
  // [lessons-merge] optional add-ons (js/lessons-member.js sets window.AD30_SIMPLE_EXT = { panel, notes, afterRender, pause }).
  // A missing or failing add-on changes nothing here.
  function ext(name) {
    var x = window.AD30_SIMPLE_EXT, a = [].slice.call(arguments, 1);
    if (!x || typeof x[name] !== "function") return "";
    try { return x[name].apply(null, a) || ""; } catch (e) { if (window.console) console.warn("[lessons]", e); return ""; }
  }

  /* ---------- countdown (same target and labels as app.js) ---------- */
  var CONFIG = {
    // 10 Nisan 5790 begins at sunset in Jerusalem on Fri Apr 12, 2030 (19:07 IDT, PyEphem).
    countdownTarget: "2030-04-12T19:07:00+03:00",
    countdownLabel: "10 Nisan · Sat Apr 13, 2030",
    dateSource: "Dates from Professor Zac’s guide · last two counted from it"
  };
  var FOOTER = { verse: "But of that day and hour knoweth no man, no, not the angels of heaven, but my Father only.", ref: "Matthew 24:36" };
  var target = new Date(CONFIG.countdownTarget).getTime();
  $("cdWhen").textContent = CONFIG.countdownLabel;
  $("dateSrc").textContent = CONFIG.dateSource;
  function tick() {
    var ms = Math.max(0, target - Date.now()), totalMin = Math.floor(ms / 60000);
    var d = Math.floor(totalMin / 1440), h = Math.floor((totalMin % 1440) / 60), m = totalMin % 60;
    $("cdD").textContent = d.toLocaleString("en-US"); $("cdH").textContent = h; $("cdM").textContent = m < 10 ? "0" + m : m;
  }
  tick(); setInterval(tick, 15000);
  $("footVerse").textContent = "“" + FOOTER.verse + "”";
  $("footRef").textContent = FOOTER.ref + " (KJV)";

  /* ---------- toast ---------- */
  var toastEl = $("toast"), toastT = null;
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove("show"); }, 2200); }

  /* ---------- progress marks on this device (same storage as app.js) ---------- */
  var prog = LS.get("ad30m.progress", {}) || {};
  function mark(id, level) {
    if (prog[id] === "watched" || prog[id] === level) return;
    prog[id] = level; LS.set("ad30m.progress", prog); paintMarks();
  }

  /* ---------- sections ---------- */
  // Section "kinds". Today there is only "lesson". Room to grow: a future "Read the Bible" section can be
  // added as another kind, e.g. KINDS.bible = { panel: fn(sec, el), notes: fn(sec) -> html }, and pushed onto
  // SECTIONS; the list, opening/closing, study notes and printing below don't need to change.
  var KINDS = { lesson: { panel: lessonPanel, notes: lessonNotes } };
  var SECTIONS = [];
  function norm(s) { return String(s || "").toLowerCase().replace(/[“”"’']/g, "").replace(/[^a-z0-9]+/g, " ").trim(); }
  function build(sheetVideos) {
    SECTIONS = (DATA.sections || []).map(function (s) {
      var c = Object.assign({}, s); c.videos = s.video ? [s.video] : []; return c;
    });
    (sheetVideos || []).forEach(function (v) {        // videos Sam adds in the Google Sheet (same matching as app.js)
      var key = norm(v.marker), sec = null;
      if (key) SECTIONS.forEach(function (s) {
        if (!sec && !s.extra && (key === s.id || key === norm(s.title) || (s.aliases || []).indexOf(key) >= 0)) sec = s;
      });
      if (sec) { if (!sec.videos.some(function (x) { return x.key === v.key; })) sec.videos.push(v); return; }
      SECTIONS.push({ id: "v-" + v.key, kind: "lesson", extra: true, title: v.title, date: v.date, dateNote: v.marker || "",
        description: "", verses: v.verse ? [{ ref: v.ref, text: v.verse, typed: v.verseFrom === "sheet" }] : [],
        teaching: [], videos: [v], aliases: [], timelineIds: [] });
    });
  }
  function byId(id) { for (var i = 0; i < SECTIONS.length; i++) if (SECTIONS[i].id === id) return i; return -1; }

  /* ---------- the list (accordion) ---------- */
  var list = $("sxList"), openIdx = -1;
  function render() {
    var keepOpen = openIdx >= 0 && SECTIONS[openIdx] ? SECTIONS[openIdx].id : null;
    closeAllPlayers(); list.innerHTML = ""; openIdx = -1;
    var extrasShown = false;
    SECTIONS.forEach(function (s, i) {
      if (s.extra && !extrasShown) {
        extrasShown = true;
        var h = document.createElement("li"); h.className = "sx-more-h"; h.setAttribute("aria-hidden", "true"); h.textContent = "More videos";
        list.appendChild(h);
      }
      var li = document.createElement("li"); li.className = "sx-item" + (s.videos.length ? " has-video" : ""); li.id = "s-" + s.id;
      li.innerHTML =
        '<h2 class="sx-h"><button class="sx-btn" type="button" id="sxb-' + esc(s.id) + '" aria-expanded="false" aria-controls="sxp-' + esc(s.id) + '">' +
          '<span class="sx-ic" aria-hidden="true"><i></i><b>✓</b></span>' +
          '<span class="sx-tt"><span class="sx-t serif"></span><span class="sx-d"></span></span>' +
          '<span class="sx-chev" aria-hidden="true"></span></button></h2>' +
        '<div class="sx-panel" id="sxp-' + esc(s.id) + '" role="region" aria-labelledby="sxb-' + esc(s.id) + '" hidden><div class="sx-in"></div></div>';
      li.querySelector(".sx-t").textContent = s.title;
      li.querySelector(".sx-d").textContent = (s.date || "") + (s.videos.length ? " · video" : "") + (s.videos.length > 1 ? "s (" + s.videos.length + ")" : "");
      li.querySelector(".sx-btn").addEventListener("click", function () { toggle(i); });
      list.appendChild(li);
    });
    paintMarks();
    ext("afterRender", list, SECTIONS);   // [lessons-merge] mark sections that have video lessons
    if (keepOpen && byId(keepOpen) >= 0) openSection(byId(keepOpen), { instant: true, noScroll: true, quiet: true });
  }
  function item(i) { return list.querySelector("#s-" + cssId(SECTIONS[i].id)); }
  function cssId(id) { return String(id).replace(/[^\w-]/g, function (c) { return "\\" + c; }); }

  var resetBtn = $("resetBtn");
  function paintMarks() {
    var any = false;
    SECTIONS.forEach(function (s, i) {
      var li = item(i); if (!li) return;
      var st = prog[s.id]; if (st) any = true;
      li.classList.toggle("watched", st === "watched"); li.classList.toggle("visited", st === "visited");
      var b = li.querySelector(".sx-btn");
      b.setAttribute("aria-label", s.title + ", " + (s.date || "") + (s.videos.length ? ", has video" : "") +
        (st === "watched" ? (s.videos.length ? ", watched" : ", finished") : st === "visited" ? ", opened" : ""));
    });
    resetBtn.hidden = !any;
  }
  resetBtn.addEventListener("click", function () { prog = {}; LS.set("ad30m.progress", prog); paintMarks(); toast("Marks cleared"); });

  function toggle(i) { if (openIdx === i) closeSection(i); else openSection(i); }

  // Smooth height animation (skipped for "reduce motion"). One section open at a time.
  function animate(panel, opening, instant, done) {
    var end = function () { panel.style.height = ""; panel.style.overflow = ""; if (!opening) panel.hidden = true; if (done) done(); };
    if (instant || RM) { if (opening) panel.hidden = false; end(); return; }
    panel.style.overflow = "hidden";
    if (opening) { panel.hidden = false; panel.style.height = "0px"; }
    else panel.style.height = panel.scrollHeight + "px";
    void panel.offsetHeight;                                     // start the transition from here
    panel.style.height = opening ? panel.scrollHeight + "px" : "0px";
    var fired = false, fin = function () { if (fired) return; fired = true; panel.removeEventListener("transitionend", onEnd); end(); };
    var onEnd = function (e) { if (e.target === panel && e.propertyName === "height") fin(); };
    panel.addEventListener("transitionend", onEnd);
    setTimeout(fin, 450);                                        // in case transitionend never fires
  }
  function openSection(i, o) {
    o = o || {};
    if (i < 0 || i >= SECTIONS.length) return;
    var prev = openIdx, prevAbove = prev >= 0 && prev < i;
    if (prev >= 0 && prev !== i) closeSection(prev, { instant: prevAbove });  // closing one above at once keeps the tapped title still
    var s = SECTIONS[i], li = item(i), btn = li.querySelector(".sx-btn"), panel = li.querySelector(".sx-panel"), inner = panel.firstChild;
    if (!inner.firstChild) (KINDS[s.kind] || KINDS.lesson).panel(s, inner, i);
    openIdx = i; li.classList.add("open"); btn.setAttribute("aria-expanded", "true");
    animate(panel, true, o.instant);
    mountYouTube(s, li);
    if (!o.noScroll) {
      var top = li.getBoundingClientRect().top;
      if (prevAbove || top < 0 || top > window.innerHeight * 0.6) li.scrollIntoView({ block: "start", behavior: RM || prevAbove ? "auto" : "smooth" });
    }
    if (!o.quiet) { mark(s.id, "visited"); AD30.track("card_open", { marker_id: s.id }); }
    try { history.replaceState(null, "", "#" + s.id); } catch (e) {}
  }
  function closeSection(i, o) {
    o = o || {};
    var li = item(i); if (!li) return;
    var panel = li.querySelector(".sx-panel");
    pausePlayers(li);
    li.classList.remove("open"); li.querySelector(".sx-btn").setAttribute("aria-expanded", "false");
    animate(panel, false, o.instant);
    if (openIdx === i) { openIdx = -1; try { history.replaceState(null, "", baseUrl()); } catch (e) {} }
  }

  /* ---------- a lesson section, opened ---------- */
  var PANEL_VERSES = 3;   // key verses shown in the list; every verse is in the study notes
  function verseHtml(v, cls) {
    return '<blockquote class="' + cls + ' serif"><p>“' + esc(v.text) + '”</p><cite>' + esc(v.ref) + ' (KJV)' +
      (v.typed ? ' · as typed in the video list' : '') + '</cite></blockquote>';
  }
  function scriptureHead(tagName) {
    return '<' + tagName + ' class="sx-sh"><span class="sx-tag">TEXT</span> What Scripture says (KJV)</' + tagName + '>';
  }
  function lessonPanel(s, el, i) {
    var h = "";
    var when = [s.date, s.dateNote].filter(Boolean).join(" · ");   // same "date · where it comes from" line the old card showed
    if (when) h += '<p class="sx-when">' + esc(when) + '</p>';
    if (s.description) h += '<p class="sx-desc">' + esc(s.description) + '</p>';
    h += '<div class="sx-videos"></div>';
    if (s.verses.length) {
      h += '<div class="sx-scrip">' + scriptureHead("h3");
      s.verses.slice(0, PANEL_VERSES).forEach(function (v) { h += verseHtml(v, "sx-v"); });
      var more = s.verses.length - PANEL_VERSES;
      if (more > 0) h += '<p class="sx-moreverses">' + more + ' more verse' + (more > 1 ? 's' : '') + ' in the study notes.</p>';
      h += '</div>';
    }
    h += '<button class="sx-notes" type="button">Study notes</button>';
    h += '<div class="sx-row"><button class="sx-link sx-share" type="button">Share</button>';
    if (i + 1 < SECTIONS.length) h += '<button class="sx-link sx-next" type="button">Next: <span></span> ›</button>';
    h += '</div>';
    el.innerHTML = h;
    var vbox = el.querySelector(".sx-videos");
    if (!s.videos.length) { var p = document.createElement("p"); p.className = "sx-soon"; p.textContent = "Video coming soon."; vbox.appendChild(p); }
    s.videos.forEach(function (v) { vbox.appendChild(v.kind === "youtube" ? youTubeBox(s, v) : mp4Box(s, v)); });
    el.querySelector(".sx-notes").addEventListener("click", function () { openNotes(s.id); });
    el.querySelector(".sx-share").addEventListener("click", function () { share(s); });
    var nx = el.querySelector(".sx-next");
    if (nx) { nx.querySelector("span").textContent = SECTIONS[i + 1].title; nx.addEventListener("click", function () { openSection(i + 1); }); }
    ext("panel", s, el, i);   // [lessons-merge] video lessons for this section (before the Study notes button)
  }

  /* ---------- videos (inline players + the same progress logging as before) ---------- */
  var sent = {};   // per page-load: milestones already logged, per video
  function tracker(s, v) {
    var st = sent[v.key] || (sent[v.key] = { m: {}, complete: false }), played = false;
    var base = { marker_id: s.id, video_id: v.key, video_title: v.title };
    function f(x) { return Object.assign({}, base, x || {}); }
    var t = {
      play: function () { if (!played) { played = true; AD30.track("video_play", f()); } },
      reset: function () { played = false; },
      progress: function (cur, dur) {
        if (!dur || !isFinite(dur)) return;
        var pct = (cur / dur) * 100;
        [25, 50, 75].forEach(function (m) { if (pct >= m && !st.m[m]) { st.m[m] = 1; AD30.track("video_progress", f({ progress_pct: m })); } });
        if (pct >= 90) t.complete();
      },
      complete: function () {
        if (!st.complete) { st.complete = true; AD30.track("video_complete", f({ progress_pct: 100 })); }
        mark(s.id, "watched");
      }
    };
    return t;
  }
  function pauseOthers(except) {
    ext("pause", null, except);   // [lessons-merge]
    [].forEach.call(document.querySelectorAll(".sx-videos video"), function (o) { if (o !== except) try { o.pause(); } catch (e) {} });
    YTS.forEach(function (y) { if (y.p !== except && y.p && y.p.pauseVideo) try { y.p.pauseVideo(); } catch (e) {} });
  }
  function mp4Box(s, v) {
    var fig = document.createElement("figure"); fig.className = "sx-vid";
    var vid = document.createElement("video");
    vid.controls = true; vid.setAttribute("playsinline", ""); vid.setAttribute("webkit-playsinline", "");
    vid.setAttribute("preload", "metadata"); if (v.poster) vid.setAttribute("poster", v.poster);
    vid.setAttribute("title", v.title); vid.setAttribute("aria-label", v.title); vid.src = v.vid || v.src;
    var cap = document.createElement("figcaption"); cap.textContent = v.title;
    var t = tracker(s, v); vid._t = t;
    vid.addEventListener("play", function () { t.play(); pauseOthers(vid); });
    vid.addEventListener("timeupdate", function () { t.progress(vid.currentTime, vid.duration); });
    vid.addEventListener("ended", function () {
      t.complete();
      try { if (vid.webkitDisplayingFullscreen) vid.webkitExitFullscreen(); if (document.fullscreenElement) document.exitFullscreen(); } catch (e) {}
    });
    fig.appendChild(vid); fig.appendChild(cap);
    return fig;
  }
  // YouTube (videos from the Google Sheet): the player is created when its section opens.
  var YTS = [], ytReady = null;
  function loadYT() {
    if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
    if (ytReady) return ytReady;
    ytReady = new Promise(function (resolve, reject) {
      var prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () { if (prev) try { prev(); } catch (e) {} resolve(window.YT); };
      var sc = document.createElement("script"); sc.src = "https://www.youtube.com/iframe_api"; sc.async = true;
      sc.onerror = function () { ytReady = null; reject(new Error("YouTube blocked")); };
      document.head.appendChild(sc);
      setTimeout(function () { if (!(window.YT && window.YT.Player)) { ytReady = null; reject(new Error("YouTube timeout")); } }, 10000);
    });
    return ytReady;
  }
  function youTubeBox(s, v) {
    var fig = document.createElement("figure"); fig.className = "sx-vid sx-yt"; fig.setAttribute("data-yt", v.vid);
    fig.innerHTML = '<div class="sx-ytbox"><div></div></div><figcaption></figcaption>';
    fig.querySelector("figcaption").textContent = v.title;
    fig._v = v; fig._s = s;
    return fig;
  }
  function mountYouTube(s, li) {
    [].forEach.call(li.querySelectorAll(".sx-yt"), function (fig) {
      if (fig._mounted) return; fig._mounted = true;
      var holder = fig.querySelector(".sx-ytbox"), inner = holder.firstChild, v = fig._v, t = tracker(s, v), rec = { fig: fig, p: null, poll: null };
      YTS.push(rec);
      loadYT().then(function (YT) {
        if (!inner.isConnected) return;
        rec.p = new YT.Player(inner, {
          videoId: v.vid, host: "https://www.youtube-nocookie.com", width: "100%", height: "100%",
          playerVars: { playsinline: 1, rel: 0, modestbranding: 1, origin: location.origin },
          events: { onStateChange: function (e) {
            var p = e.target;
            if (e.data === 1) { t.play(); pauseOthers(p); clearInterval(rec.poll); rec.poll = setInterval(function () { try { t.progress(p.getCurrentTime(), p.getDuration()); } catch (x) {} }, 2000); }
            else if (e.data === 2) { clearInterval(rec.poll); try { t.progress(p.getCurrentTime(), p.getDuration()); } catch (x) {} }
            else if (e.data === 0) { clearInterval(rec.poll); t.complete(); }
          } }
        });
      }).catch(function () {   // YouTube API blocked: a plain embed still plays, we just can't see progress
        var f = document.createElement("iframe");
        f.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(v.vid) + "?playsinline=1&rel=0";
        f.title = v.title; f.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen";
        f.setAttribute("allowfullscreen", ""); holder.innerHTML = ""; holder.appendChild(f);
      });
    });
  }
  function pausePlayers(li) {
    ext("pause", li, null);   // [lessons-merge]
    [].forEach.call(li.querySelectorAll("video"), function (v) { try { v.pause(); } catch (e) {} if (v._t) v._t.reset(); });
    YTS.forEach(function (y) { if (li.contains(y.fig)) { clearInterval(y.poll); if (y.p && y.p.pauseVideo) try { y.p.pauseVideo(); } catch (e) {} } });
  }
  function closeAllPlayers() {
    [].forEach.call(list.querySelectorAll("video"), function (v) { try { v.pause(); } catch (e) {} });
    YTS.forEach(function (y) { clearInterval(y.poll); if (y.p && y.p.destroy) try { y.p.destroy(); } catch (e) {} });
    YTS = [];
  }

  /* ---------- share (same as app.js) ---------- */
  function baseUrl() { return location.href.split("#")[0].split("?")[0]; }
  function copyText(t) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(t);
    return new Promise(function (res, rej) {
      var ta = document.createElement("textarea"); ta.value = t; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); var ok = false; try { ok = document.execCommand("copy"); } catch (e) {}
      document.body.removeChild(ta); if (ok) res(); else rej();
    });
  }
  function share(s) {
    var url = baseUrl() + "#" + s.id;
    var data = { title: "The Thirtieth Year · " + s.title, text: s.title + " — " + (s.date || "") + " (sign-in needed)", url: url };
    function fallback() { copyText(url).then(function () { toast("Link copied"); }, function () { toast(url); }); }
    if (navigator.share) navigator.share(data).catch(function (err) { if (!err || err.name !== "AbortError") fallback(); });
    else fallback();
  }

  /* ---------- Study notes (read-along page + Print) ---------- */
  var notes = $("notes"), ntBody = $("ntBody"), page = $("page"), notesFrom = null, notesPushed = false, notesMode = null;
  function today() {
    try { return new Date().toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" }); }
    catch (e) { return new Date().toDateString(); }
  }
  function lessonNotes(s) {
    var h = '<article class="nt-sec" aria-labelledby="nth-' + esc(s.id) + '">' +
      '<header class="nt-head"><p class="nt-kick">The Thirtieth Year · Study notes</p>' +
      '<h1 class="nt-h1" id="nth-' + esc(s.id) + '" tabindex="-1">' + esc(s.title) + '</h1>';
    var when = [s.date, s.dateNote].filter(Boolean).join(" · ");
    if (when) h += '<p class="nt-date">' + esc(when) + '</p>';
    h += '</header>';
    if (s.description) h += '<p class="nt-desc">' + esc(s.description) + '</p>';
    if (s.verses.length) {
      h += '<section class="nt-scrip">' + scriptureHead("h2");
      s.verses.forEach(function (v) { h += verseHtml(v, "nt-v"); });
      h += '</section>';
    }
    var groups = [["guide", "From Professor Zac’s guide"], ["video", "From the video lesson " + (s.video && s.video.lesson ? s.video.lesson : "")]];
    var teach = s.teaching || [];
    if (teach.length) {
      h += '<section class="nt-teach"><h2 class="nt-th">Teaching</h2><p class="nt-note">Notes on the passage — teaching, not Scripture.</p>';
      groups.forEach(function (g) {
        var items = teach.filter(function (t) { return t.from === g[0]; });
        if (!items.length) return;
        h += '<h3 class="nt-g">' + esc(g[1]) + '</h3><ul class="nt-list">';
        // teaching html is generated from the site's own pages (only <b> and <i> kept) - see js/simple-data.js
        items.forEach(function (t) { h += '<li>' + t.html + '</li>'; });
        h += '</ul>';
      });
      h += '</section>';
    }
    h += ext("notes", s);   // [lessons-merge] the section's video lessons (title, summary, KJV verses)
    h += '<p class="nt-meta"><span class="nt-pdate">Printed ' + esc(today()) + ' · </span>' + esc(DATA.kjvNote || "Scripture quotations are from the King James Version (KJV).") + '</p>';
    return h + '</article>';
  }
  function notesHtml(s) { return (KINDS[s.kind] || KINDS.lesson).notes(s); }
  function fillNotes(id) {
    if (id === "all") {
      notesMode = "all";
      ntBody.innerHTML = '<p class="nt-allh">All study notes · ' + SECTIONS.length + ' sections</p>' + SECTIONS.map(notesHtml).join("");
    } else {
      var i = byId(id); if (i < 0) return false;
      notesMode = id; ntBody.innerHTML = notesHtml(SECTIONS[i]);
    }
    return true;
  }
  function openNotes(id, fromHash) {
    if (!fillNotes(id)) return false;
    if (notes.hidden) notesFrom = document.activeElement;
    notes.hidden = false; notes.scrollTop = 0;
    document.documentElement.classList.add("notes-open");
    page.setAttribute("aria-hidden", "true"); if ("inert" in page) page.inert = true;
    pauseOthers(null);
    if (!fromHash) {   // so the phone's Back gesture closes the notes
      try { history.pushState({ notes: id }, "", "#notes-" + id); notesPushed = true; } catch (e) {}
    }
    var i = byId(id);
    if (i >= 0 && !SECTIONS[i].videos.length) mark(id, "watched");   // a section without a video counts as finished once its notes are read
    AD30.track("read_aloud", { marker_id: id });   // logged under the kind "Read it to me" used (the database accepts only its fixed list of kinds)
    setTimeout(function () { var h = ntBody.querySelector(".nt-h1"); try { (h || $("ntClose")).focus({ preventScroll: true }); } catch (e) {} }, 30);
    return true;
  }
  function hideNotes() {
    if (notes.hidden) return;
    notes.hidden = true; ntBody.innerHTML = ""; notesMode = null;
    document.documentElement.classList.remove("notes-open");
    page.removeAttribute("aria-hidden"); if ("inert" in page) page.inert = false;
    if (notesFrom && notesFrom.focus) try { notesFrom.focus({ preventScroll: true }); } catch (e) {}
  }
  function closeNotes() {
    if (notesPushed) { notesPushed = false; try { history.back(); return; } catch (e) {} }   // hashchange/popstate then hides it
    hideNotes();
    var cur = openIdx >= 0 ? "#" + SECTIONS[openIdx].id : "";
    try { history.replaceState(null, "", baseUrl() + cur); } catch (e) {}
  }
  $("ntClose").addEventListener("click", closeNotes);
  $("ntClose2").addEventListener("click", closeNotes);
  $("ntPrint").addEventListener("click", function () { window.print(); });
  $("ntPrintAll").addEventListener("click", function () {
    fillNotes("all"); notes.scrollTop = 0;
    AD30.track("read_aloud", { marker_id: "print-all" });
    setTimeout(function () { window.print(); }, 60);
  });
  // Printing from the browser's own menu (outside the notes) also gives the clean notes, for every section.
  var tmpPrint = false;
  function beforePrint() {
    if (!started || !notes.hidden) return;
    tmpPrint = true; fillNotes("all"); notes.hidden = false; document.documentElement.classList.add("notes-open", "print-only-notes");
  }
  function afterPrint() {
    if (!tmpPrint) return;
    tmpPrint = false; notes.hidden = true; ntBody.innerHTML = ""; notesMode = null;
    document.documentElement.classList.remove("notes-open", "print-only-notes");
  }
  window.addEventListener("beforeprint", beforePrint);
  window.addEventListener("afterprint", afterPrint);
  document.addEventListener("keydown", function (e) {
    if (notes.hidden) return;
    if (e.key === "Escape") { e.preventDefault(); closeNotes(); return; }
    if (e.key === "Tab") {   // keep keyboard focus inside the notes while they are open
      var f = [].filter.call(notes.querySelectorAll("button,[href],[tabindex]:not([tabindex='-1'])"), function (el) { return el.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!notes.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    }
  }, true);

  /* ---------- deep links: #section, #notes-section, #v-<videoKey>, timeline ids (#jn737), simple names ---------- */
  function openFromId(id) {
    if (!id) return false;
    if (id.indexOf("notes-") === 0) return openNotes(id.slice(6), true);
    var k = byId(id); if (k < 0 && id.indexOf("s-") === 0) k = byId(id.slice(2));
    if (k < 0 && id.indexOf("v-") === 0) {
      var key = id.slice(2);
      SECTIONS.forEach(function (s, i) { if (k < 0 && s.videos.some(function (v) { return v.key === key; })) k = i; });
    }
    if (k < 0) SECTIONS.forEach(function (s, i) { if (k < 0 && ((s.timelineIds || []).indexOf(id) >= 0 || (s.aliases || []).indexOf(norm(id)) >= 0)) k = i; });
    if (k < 0) return false;
    if (openIdx !== k) openSection(k, { instant: true });
    return true;
  }
  function onHash() {
    if (!started) return;
    var h = decodeURIComponent(location.hash.slice(1));
    if (h.indexOf("notes-") !== 0) { notesPushed = false; hideNotes(); }
    if (h && !openFromId(h) && window.AD30L && window.AD30L.openSimple && $("lxSimple")) window.AD30L.openSimple(h);   // merge hook: video lessons (js/lessons.js), if present
  }
  window.addEventListener("hashchange", onHash);
  window.addEventListener("popstate", onHash);

  /* ---------- account box + group-leader links ---------- */
  function setupAccount(user) {
    $("whoami").textContent = user.email || "";
    $("signOut").addEventListener("click", AD30.signOut);
    // Teacher view link only for group leaders (same check as the rest of the site). This only hides links:
    // the real protection of member data is the database's own admin check.
    AD30.checkAdmin(user).then(function (isAdmin) {
      if (!isAdmin) return;
      $("teacherTop").hidden = false; $("leaderLinks").hidden = false; $("adminLink").hidden = false;
      document.documentElement.classList.add("is-leader");
    });
    var box = $("notifyBox"), cb = $("notify");
    if (AD30.demo) { box.hidden = false; cb.checked = true; cb.addEventListener("change", function () { toast(cb.checked ? "Emails on (demo)" : "Emails off (demo)"); }); return; }
    AD30.sb.from("members").select("notify").eq("user_id", user.id).maybeSingle().then(function (r) {
      if (r.error || !r.data) return;
      box.hidden = false; cb.checked = !!r.data.notify;
    });
    cb.addEventListener("change", function () {
      var val = cb.checked; cb.disabled = true;
      AD30.sb.from("members").update({ notify: val }).eq("user_id", user.id).then(function (r) {
        cb.disabled = false;
        if (r.error) { cb.checked = !val; toast("Couldn’t save — try again"); }
        else toast(val ? "You’ll get an email for new videos" : "New-video emails turned off");
      });
    });
  }

  /* ---------- free window / paywall (same as app.js; enforced only when paywall_enabled = true in the database) ---------- */
  function checkAccess(user) {
    if (AD30.demo) return Promise.resolve(true);
    return AD30.sb.rpc("my_access").then(function (r) {
      var a = r.data || {};
      if (r.error) return true;       // can't tell (e.g. offline) -> don't lock people out; the database is the real gate
      var ref = AD30.refCode();
      if (ref && !a.referral_code) AD30.sb.rpc("claim_referral", { p_code: ref });
      if (a.paywall_enabled && a.has_access && typeof a.days_left === "number" && a.days_left <= 30) {
        $("accessLine").hidden = false;
        $("accessLine").textContent = "Free access: " + a.days_left + (a.days_left === 1 ? " day" : " days") + " left";
      }
      if (a.paywall_enabled && a.has_access === false) {
        $("page").hidden = true; $("ended").hidden = false; $("endedWho").textContent = user.email || "";
        $("endedOut").addEventListener("click", AD30.signOut);
        AD30.track("page_view", { marker_id: "access-ended" });
        return false;
      }
      return true;
    }, function () { return true; });
  }

  /* ---------- start ---------- */
  build([]); render();   // sections show at once; Sheet videos (if any) arrive later
  AD30.startAuth({
    onIn: function (user, how) {
      if (started) return; started = true;
      if (how === "link" || how === "code") AD30.track("sign_in");
      checkAccess(user).then(function (ok) { if (ok) showSite(user); });
    },
    onOut: function () { $("page").hidden = true; hideNotes(); }
  });

  function showSite(user) {
    $("page").hidden = false;
    AD30.track("page_view");
    setupAccount(user);
    var lessonsDone = Promise.resolve();   // merge hook: video lessons from the group leader page (js/lessons.js), if present
    try { if (window.AD30L && window.AD30L.simple && $("lxSimple")) lessonsDone = window.AD30L.simple().catch(function () {}); } catch (e) {}
    var status = $("vidStatus");
    var h = decodeURIComponent(location.hash.slice(1));
    if (/access_token|error_code/.test(h)) h = "";
    var want = h || LS.get("ad30m.deeplink", "");
    LS.del("ad30m.deeplink");
    if (!h) { try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {} }
    if (want) openFromId(want);           // built-in sections can open straight away
    AD30.loadVideos().then(function (s) {
      window.__ad30sheet = s;
      if (s.videos && s.videos.length) { build(s.videos); render(); if (want && openIdx < 0 && notes.hidden) openFromId(want); }
      if (s.error === "no-sheet") status.textContent = "";
      else if (s.error && s.fromCache) status.textContent = "Showing the saved video list (couldn’t refresh just now).";
      else if (s.error) status.textContent = "Couldn’t load the video list right now. Please try again later.";
      else status.textContent = "";
      if (want && openIdx < 0 && notes.hidden && !openFromId(want)) lessonsDone.then(function () { if (window.AD30L && window.AD30L.openSimple && $("lxSimple")) window.AD30L.openSimple(want); });
    });
    tipOnce();
  }

  /* ---------- one-time "Add to Home Screen" tip (iPhone/iPad Safari only; same as app.js) ---------- */
  function tipOnce() {
    var ua = navigator.userAgent || "";
    var ios = /iP(hone|od|ad)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    var safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA|FBAN|FBAV|Instagram/.test(ua);
    var standalone = navigator.standalone === true || (window.matchMedia && matchMedia("(display-mode: standalone)").matches);
    if (!ios || !safari || standalone || LS.get("ad30m.tip", 0)) return;
    var tip = $("tip");
    setTimeout(function () { tip.hidden = false; LS.set("ad30m.tip", 1); setTimeout(function () { tip.hidden = true; }, 15000); }, 3000);
    $("tipX").addEventListener("click", function () { tip.hidden = true; });
  }

  // for tests
  window.__simple = { sections: function () { return SECTIONS; }, open: openSection, close: closeSection, openNotes: openNotes,
                      closeNotes: closeNotes, openIdx: function () { return openIdx; } };
})();
