/* AD30 members - main page. Built from ad30-simple (same markers, verses, countdown, sheet,
   Read it to me, Next card, watched marks, share, Add to Home Screen tip) plus sign-in,
   videos from Sam's Google Sheet (YouTube), and engagement logging. */
(function () {
  "use strict";
  var AD30 = window.AD30, $ = AD30.$, LS = AD30.LS;

  // === Countdown (unchanged from ad30-simple) ===
  var CONFIG = {
    // 10 Nisan 5790 begins at sunset in Jerusalem on Fri Apr 12, 2030 (19:07 IDT, PyEphem).
    countdownTarget: "2030-04-12T19:07:00+03:00",
    countdownLabel: "10 Nisan · Sat Apr 13, 2030",
    dateSource: "Dates from Professor Zac’s guide · last two counted from it"
  };

  // === Markers: copied verbatim from ad30-simple (exact KJV, already checked). ===
  // "aliases" = words Sam can type in the sheet's marker column to attach a video to this card.
  var MARKERS = [
    { id: "birth", title: "Birth", date: "Sept 11, 5 BC", aliases: ["birth", "nativity", "trumpets"],
      verse: "For unto you is born this day in the city of David a Saviour, which is Christ the Lord.", ref: "Luke 2:11" },
    { id: "jordan", title: "The Jordan", date: "Sept 11, AD 26", aliases: ["jordan", "baptism", "the jordan"],
      verse: "And the Holy Ghost descended in a bodily shape like a dove upon him, and a voice came from heaven, which said, Thou art my beloved Son; in thee I am well pleased.", ref: "Luke 3:22" },
    { id: "tabernacles", title: "“That great day”", date: "Mon Oct 17, AD 29 · Tabernacles", aliases: ["tabernacles", "sukkot", "that great day", "booths"],
      verse: "In the last day, that great day of the feast, Jesus stood and cried, saying, If any man thirst, let him come unto me, and drink.", ref: "John 7:37" },
    { id: "passover", title: "Passover · The Cross", date: "Wed Apr 5, AD 30", aliases: ["passover", "the cross", "cross", "crucifixion"],
      verse: "When Jesus therefore had received the vinegar, he said, It is finished: and he bowed his head, and gave up the ghost.", ref: "John 19:30" },
    { id: "resurrection", title: "He is risen", date: "Sat Apr 8 – Sun Apr 9, AD 30", aliases: ["resurrection", "he is risen", "risen", "firstfruits", "first fruits"],
      source: "72 hours from the Wednesday burial (the guide gives no hour)",
      verse: "He is not here: for he is risen, as he said. Come, see the place where the Lord lay.", ref: "Matthew 28:6" },
    { id: "pentecost", title: "Pentecost", date: "Sun May 28, AD 30", aliases: ["pentecost", "shavuot", "weeks"],
      source: "Counted 50 days (the guide doesn’t give this date)",
      verse: "And when the day of Pentecost was fully come, they were all with one accord in one place.", ref: "Acts 2:1" }
  ];
  var FOOTER = { verse: "But of that day and hour knoweth no man, no, not the angels of heaven, but my Father only.", ref: "Matthew 24:36" };

  var CARDS = [];          // markers + extra cards from the sheet
  var started = false;

  /* ---------- countdown ---------- */
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

  /* ---------- progress (on this device) ---------- */
  var prog = LS.get("ad30m.progress", {}) || {}, done = LS.get("ad30m.done", {}) || {};
  function mark(id, level) {
    if (prog[id] === "watched" || prog[id] === level) return;
    prog[id] = level; LS.set("ad30m.progress", prog); paintMarks();
  }
  function markDone(key) { done[key] = 1; LS.set("ad30m.done", done); }

  /* ---------- toast ---------- */
  var toastEl = $("toast"), toastT = null;
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove("show"); }, 2200); }

  /* ---------- build cards from markers + sheet ---------- */
  function norm(s) { return String(s || "").toLowerCase().replace(/[“”"’']/g, "").replace(/[^a-z0-9]+/g, " ").trim(); }
  function attach(videos) {
    CARDS = MARKERS.map(function (m) { var c = Object.assign({}, m); c.videos = []; return c; });
    videos.forEach(function (v) {
      var key = norm(v.marker), card = null;
      if (key) for (var i = 0; i < MARKERS.length && !card; i++) {
        var mk = MARKERS[i];
        if (key === mk.id || key === norm(mk.title) || mk.aliases.indexOf(key) >= 0) card = CARDS[i];
      }
      if (card) card.videos.push(v);
      else CARDS.push({ id: "v-" + v.key, title: v.title, date: v.date, verse: v.verse, ref: v.ref, videos: [v], extra: true,
                        source: v.marker ? v.marker : "" });
    });
  }

  var path = $("path"), btns = [];
  function render() {
    path.innerHTML = ""; btns = [];
    var extrasShown = false;
    CARDS.forEach(function (c, i) {
      if (c.extra && !extrasShown) {
        extrasShown = true;
        var h = document.createElement("li"); h.className = "more-h"; h.setAttribute("aria-hidden", "true"); h.textContent = "More videos";
        path.appendChild(h);
      }
      var li = document.createElement("li"), b = document.createElement("button");
      b.type = "button"; b.className = "mk" + (c.videos.length ? " has-video" : "");
      b.setAttribute("aria-haspopup", "dialog");
      b.innerHTML = '<span class="dot" aria-hidden="true"><i></i><b>✓</b></span><span><span class="t serif"></span><span class="d"></span></span>';
      b.querySelector(".t").textContent = c.title;
      b.querySelector(".d").textContent = c.date + (c.videos.length > 1 ? " · " + c.videos.length + " videos" : "");
      b.addEventListener("click", function () { openSheet(i); });
      li.appendChild(b); path.appendChild(li); btns.push(b);
    });
    paintMarks();
  }
  var resetBtn = $("resetBtn");
  function paintMarks() {
    var any = false;
    CARDS.forEach(function (c, i) {
      var st = prog[c.id], b = btns[i]; if (!b) return;
      b.classList.toggle("watched", st === "watched"); b.classList.toggle("visited", st === "visited");
      if (st) any = true;
      b.setAttribute("aria-label", c.title + ", " + c.date + (c.videos.length ? ", has video" : "") +
        (st === "watched" ? (c.videos.length ? ", watched" : ", finished") : st === "visited" ? ", opened" : ""));
    });
    resetBtn.hidden = !any;
  }
  resetBtn.addEventListener("click", function () {
    prog = {}; done = {}; LS.set("ad30m.progress", prog); LS.set("ad30m.done", done); paintMarks(); toast("Marks cleared");
  });

  /* ---------- speech (Read it to me) ---------- */
  var synth = window.speechSynthesis || null;
  var readBtn = $("shRead"), speaking = false, current = null, curIndex = -1, speakToken = 0, curVerse = null;
  if (!synth || typeof SpeechSynthesisUtterance === "undefined") readBtn.hidden = true;
  function pickVoice() {
    if (!synth) return null;
    var vs = synth.getVoices() || [], pref = ["Daniel", "Samantha", "Karen", "Moira", "Google UK English Male", "Google US English"];
    for (var p = 0; p < pref.length; p++) for (var v = 0; v < vs.length; v++) if (vs[v].name.indexOf(pref[p]) === 0) return vs[v];
    for (var k = 0; k < vs.length; k++) if (/^en/i.test(vs[k].lang)) return vs[k];
    return null;
  }
  if (synth && "onvoiceschanged" in synth) synth.onvoiceschanged = function () {};
  function setReading(on) { speaking = on; readBtn.setAttribute("aria-pressed", on ? "true" : "false"); readBtn.textContent = on ? "■ Stop reading" : "🔊 Read it to me"; }
  function stopSpeech() { speakToken++; if (synth) synth.cancel(); setReading(false); }
  readBtn.addEventListener("click", function () {
    if (!synth || !current || !curVerse) return;
    if (speaking || synth.speaking) { stopSpeech(); return; }
    synth.cancel();
    var refSpoken = curVerse.ref.replace(":", ", verse ").replace(/-(\d+)$/, " to $1").replace(/^1 /, "First ").replace(/^2 /, "Second ");
    var u = new SpeechSynthesisUtterance(curVerse.text + " … " + refSpoken + ".");
    var v = pickVoice(); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = "en-US";
    u.rate = 0.9; u.pitch = 1;
    var token = ++speakToken, id = current.id, hasVid = current.videos.length > 0;
    u.onend = function () { if (token === speakToken) { setReading(false); if (!hasVid) mark(id, "watched"); } };
    u.onerror = function () { if (token === speakToken) setReading(false); };
    setReading(true); synth.speak(u); if (synth.paused) synth.resume();
    AD30.track("read_aloud", { marker_id: id });
  });

  /* ---------- share ---------- */
  function baseUrl() { return location.href.split("#")[0].split("?")[0]; }
  function copyText(t) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(t);
    return new Promise(function (res, rej) {
      var ta = document.createElement("textarea"); ta.value = t; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      sheet.appendChild(ta); ta.select(); var ok = false; try { ok = document.execCommand("copy"); } catch (e) {}
      sheet.removeChild(ta); ok ? res() : rej();
    });
  }
  $("shShare").addEventListener("click", function () {
    if (!current) return;
    var url = baseUrl() + "#" + current.id;
    var data = { title: "The Thirtieth Year · " + current.title, text: current.title + " — " + current.date + " (sign-in needed)", url: url };
    function fallback() { copyText(url).then(function () { toast("Link copied"); }, function () { toast(url); }); }
    if (navigator.share) navigator.share(data).catch(function (err) { if (!err || err.name !== "AbortError") fallback(); });
    else fallback();
  });

  /* ---------- video players + tracking ---------- */
  var ytReady = null;
  function loadYT() {
    if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
    if (ytReady) return ytReady;
    ytReady = new Promise(function (resolve, reject) {
      var prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () { if (prev) try { prev(); } catch (e) {} resolve(window.YT); };
      var s = document.createElement("script"); s.src = "https://www.youtube.com/iframe_api"; s.async = true;
      s.onerror = function () { ytReady = null; reject(new Error("YouTube blocked")); };
      document.head.appendChild(s);
      setTimeout(function () { if (!(window.YT && window.YT.Player)) { ytReady = null; reject(new Error("YouTube timeout")); } }, 10000);
    });
    return ytReady;
  }
  var sent = {};   // per page-load: which milestones already logged, per video
  function tracker(card, v) {
    var s = sent[v.key] || (sent[v.key] = { m: {}, complete: false }), playedThisOpen = false;
    var base = { marker_id: card.id, video_id: v.key, video_title: v.title };
    function f(extra) { return Object.assign({}, base, extra || {}); }
    return {
      play: function () { if (!playedThisOpen) { playedThisOpen = true; AD30.track("video_play", f()); } cancelNext(); },
      progress: function (cur, dur) {
        if (!dur || !isFinite(dur)) return;
        var pct = (cur / dur) * 100;
        [25, 50, 75].forEach(function (m) { if (pct >= m && !s.m[m]) { s.m[m] = 1; AD30.track("video_progress", f({ progress_pct: m })); } });
        if (pct >= 90) this.complete();
      },
      complete: function () {
        if (!s.complete) { s.complete = true; AD30.track("video_complete", f({ progress_pct: 100 })); }
        markDone(v.key); mark(card.id, "watched"); paintChips();
      }
    };
  }

  var player = null, poll = null, activeVideo = 0;
  function destroyPlayer() {
    clearInterval(poll); poll = null;
    if (player) { try { player.destroy ? player.destroy() : player.pause(); } catch (e) {} player = null; }
  }
  function buildYouTube(card, v, auto) {
    var wrap = document.createElement("div"); wrap.className = "media";
    var holder = document.createElement("div"); holder.className = "yt"; holder.style.aspectRatio = "16/9"; holder.style.background = "#000"; holder.style.borderRadius = "14px";
    var inner = document.createElement("div"); holder.appendChild(inner);
    var cap = document.createElement("div"); cap.className = "vt"; cap.textContent = v.title;
    wrap.appendChild(holder); wrap.appendChild(cap);
    var t = tracker(card, v);
    loadYT().then(function (YT) {
      if (!inner.isConnected) return;
      player = new YT.Player(inner, {
        videoId: v.vid, host: "https://www.youtube-nocookie.com", width: "100%", height: "100%",
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1, origin: location.origin },
        events: {
          onReady: function (e) { if (auto) try { e.target.playVideo(); } catch (x) {} },
          onStateChange: function (e) {
            var p = e.target;
            if (e.data === 1) {            // playing
              t.play(); clearInterval(poll);
              poll = setInterval(function () { try { t.progress(p.getCurrentTime(), p.getDuration()); } catch (x) {} }, 2000);
            } else if (e.data === 2) {     // paused
              clearInterval(poll); try { t.progress(p.getCurrentTime(), p.getDuration()); } catch (x) {}
            } else if (e.data === 0) {     // ended
              clearInterval(poll); t.complete(); showNext();
            }
          }
        }
      });
    }).catch(function () {
      // YouTube API blocked: plain embed still plays, we just can't see progress.
      var f = document.createElement("iframe");
      f.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(v.vid) + "?playsinline=1&rel=0";
      f.title = v.title; f.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen";
      f.setAttribute("allowfullscreen", ""); f.style.width = "100%"; f.style.height = "100%";
      holder.innerHTML = ""; holder.appendChild(f);
    });
    return wrap;
  }
  function buildMp4(card, v, auto) {
    var wrap = document.createElement("div"); wrap.className = "media";
    var box = document.createElement("div"); box.className = "vbox";
    var vid = document.createElement("video");
    vid.controls = true; vid.setAttribute("playsinline", ""); vid.setAttribute("preload", "metadata"); vid.src = v.vid; vid.setAttribute("title", v.title);
    var big = document.createElement("button"); big.type = "button"; big.className = "bigplay"; big.hidden = true; big.setAttribute("aria-label", "Play video"); big.textContent = "▶";
    big.addEventListener("click", function () { big.hidden = true; var p = vid.play(); if (p && p.catch) p.catch(function () { big.hidden = false; }); });
    var t = tracker(card, v);
    vid.addEventListener("play", function () { big.hidden = true; t.play(); });
    vid.addEventListener("timeupdate", function () { t.progress(vid.currentTime, vid.duration); });
    vid.addEventListener("ended", function () {
      t.complete();
      try { if (vid.webkitDisplayingFullscreen) vid.webkitExitFullscreen(); if (document.fullscreenElement) document.exitFullscreen(); } catch (e) {}
      showNext();
    });
    box.appendChild(vid); box.appendChild(big);
    var cap = document.createElement("div"); cap.className = "vt"; cap.textContent = v.title;
    wrap.appendChild(box); wrap.appendChild(cap);
    player = { pause: function () { vid.pause(); } };
    if (auto) { var p = vid.play(); if (p && p.catch) p.catch(function () { big.hidden = false; }); }
    return wrap;
  }

  /* ---------- sheet (card detail) ---------- */
  var sheet = $("sheet"), scrim = $("scrim"), page = $("page");
  var nx = $("shNext"), nxT = null, nxLeft = 0, NEXT_SECS = 5;
  function cancelNext() { clearInterval(nxT); nxT = null; nx.hidden = true; }
  function showNext() {
    var ni = curIndex + 1; if (ni >= CARDS.length) return;
    $("shNextT").textContent = "Next: " + CARDS[ni].title;
    nxLeft = NEXT_SECS; var inEl = $("shNextIn");
    function lbl() { inEl.textContent = "Opens in " + nxLeft + "s"; }
    lbl(); nx.hidden = false; if (nx.scrollIntoView) nx.scrollIntoView({ block: "nearest" });
    clearInterval(nxT);
    nxT = setInterval(function () { nxLeft--; if (nxLeft <= 0) { cancelNext(); openSheet(ni, true); } else lbl(); }, 1000);
    try { $("shNextGo").focus({ preventScroll: true }); } catch (e) {}
  }
  $("shNextGo").addEventListener("click", function () { var ni = curIndex + 1; cancelNext(); openSheet(ni, true); });
  $("shNextCancel").addEventListener("click", function () { cancelNext(); $("shClose").focus(); });

  function paintChips() {
    var list = $("shVideos"); if (!list || !current) return;
    [].forEach.call(list.querySelectorAll("button"), function (b, i) {
      b.setAttribute("aria-pressed", i === activeVideo ? "true" : "false");
      b.classList.toggle("done", !!done[current.videos[i].key]);
    });
  }
  function showVerse(text, ref) {
    curVerse = text ? { text: text, ref: ref } : null;
    $("shQuote").hidden = !text;
    $("shVerse").textContent = text ? "“" + text + "”" : "";
    $("shRef").textContent = ref ? ref + " (KJV)" : "";
    readBtn.hidden = !text || !synth;
  }
  function showVideo(k, auto) {
    destroyPlayer(); stopSpeech();
    activeVideo = k;
    var media = $("shMedia"); media.innerHTML = "";
    var v = current.videos[k];
    if (!v) {
      var p = document.createElement("p"); p.className = "soon"; p.textContent = "Video coming soon."; media.appendChild(p);
      showVerse(current.verse, current.ref); return;
    }
    media.appendChild(v.kind === "mp4" ? buildMp4(current, v, auto) : buildYouTube(current, v, auto));
    if (current.videos.length > 1) {
      var list = document.createElement("div"); list.className = "vlist"; list.id = "shVideos"; list.setAttribute("aria-label", "Videos for this date");
      current.videos.forEach(function (vv, j) {
        var b = document.createElement("button"); b.type = "button"; b.textContent = vv.title;
        b.addEventListener("click", function () { if (j !== activeVideo) showVideo(j, false); });
        list.appendChild(b);
      });
      media.appendChild(list); paintChips();
    }
    // verse: the video's own KJV verse if the sheet gives one, otherwise the card's verse
    if (v.verse) showVerse(v.verse, v.ref); else showVerse(current.verse, current.ref);
  }

  function openSheet(i, auto, videoKey) {
    if (i < 0 || i >= CARDS.length) return;
    cancelNext();
    current = CARDS[i]; curIndex = i;
    $("shTitle").textContent = current.title;
    $("shDate").textContent = [current.date, current.extra ? current.source : (current.source || "Professor Zac’s guide")].filter(Boolean).join(" · ");
    var k = 0;
    if (videoKey) current.videos.forEach(function (v, j) { if (v.key === videoKey) k = j; });
    showVideo(k, auto);
    mark(current.id, "visited");
    AD30.track("card_open", { marker_id: current.id });
    sheet.classList.add("open"); scrim.classList.add("open"); sheet.setAttribute("aria-hidden", "false");
    page.setAttribute("aria-hidden", "true"); if ("inert" in page) page.inert = true;
    document.body.style.overflow = "hidden"; sheet.scrollTop = 0;
    try { history.replaceState(null, "", "#" + (videoKey ? "v-" + videoKey : current.id)); } catch (e) {}
    setTimeout(function () { $("shClose").focus(); }, 30);
  }
  function closeSheet() {
    if (!sheet.classList.contains("open")) return;
    stopSpeech(); cancelNext(); destroyPlayer(); $("shMedia").innerHTML = "";
    sheet.classList.remove("open"); scrim.classList.remove("open"); sheet.setAttribute("aria-hidden", "true");
    page.removeAttribute("aria-hidden"); if ("inert" in page) page.inert = false;
    document.body.style.overflow = "";
    try { history.replaceState(null, "", baseUrl()); } catch (e) {}
    if (btns[curIndex]) btns[curIndex].focus();
  }
  $("shClose").addEventListener("click", closeSheet);
  scrim.addEventListener("click", closeSheet);
  document.addEventListener("keydown", function (e) {
    if (!sheet.classList.contains("open")) return;
    if (e.key === "Escape") { e.preventDefault(); closeSheet(); return; }
    if (e.key === "Tab") {
      var f = [].filter.call(sheet.querySelectorAll('button:not([hidden]),video,iframe,[href],[tabindex]:not([tabindex="-1"])'),
        function (el) { return el.offsetParent !== null || el === document.activeElement; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!sheet.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    }
  }, true);
  var y0 = null;
  sheet.addEventListener("touchstart", function (e) { y0 = sheet.scrollTop <= 0 ? e.touches[0].clientY : null; }, { passive: true });
  sheet.addEventListener("touchend", function (e) { if (y0 !== null && e.changedTouches[0].clientY - y0 > 90) closeSheet(); y0 = null; }, { passive: true });

  /* ---------- deep links: #marker-id or #v-<videoKey> ---------- */
  function openFromId(id) {
    if (!id) return false;
    for (var k = 0; k < CARDS.length; k++) if (CARDS[k].id === id) { openSheet(k); return true; }
    if (id.indexOf("v-") === 0) {
      var key = id.slice(2);
      for (var c = 0; c < CARDS.length; c++) for (var j = 0; j < CARDS[c].videos.length; j++)
        if (CARDS[c].videos[j].key === key) { openSheet(c, false, key); return true; }
    }
    return false;
  }
  window.addEventListener("hashchange", function () { if (started) openFromId(decodeURIComponent(location.hash.slice(1))); });

  /* ---------- account box ---------- */
  function setupAccount(user) {
    $("whoami").textContent = user.email || "";
    $("signOut").addEventListener("click", AD30.signOut);
    var box = $("notifyBox"), cb = $("notify");
    if (AD30.demo) { box.hidden = false; cb.checked = true; cb.addEventListener("change", function () { toast(cb.checked ? "Emails on (demo)" : "Emails off (demo)"); }); $("adminLink").hidden = false; return; }
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
    if (AD30.isAdminEmail(user.email)) $("adminLink").hidden = false;
    AD30.sb.rpc("am_i_admin").then(function (r) { if (r.data === true) $("adminLink").hidden = false; });
  }

  /* ---------- free window / paywall (enforced only when paywall_enabled = true in the database) ---------- */
  function checkAccess(user) {
    if (AD30.demo) return Promise.resolve(true);
    return AD30.sb.rpc("my_access").then(function (r) {
      var a = r.data || {};
      if (r.error) return true;       // can't tell (e.g. offline) -> don't lock people out; the database is the real gate
      var ref = AD30.refCode();
      if (ref && !a.referral_code) AD30.sb.rpc("claim_referral", { p_code: ref });   // first-touch safety net (24h window)
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

  /* ---------- start after sign-in ---------- */
  attach([]); render();   // markers show instantly; videos arrive from the sheet
  AD30.startAuth({
    onIn: function (user, how) {
      if (started) return; started = true;
      if (how === "link" || how === "code") AD30.track("sign_in");
      checkAccess(user).then(function (ok) { if (ok) showSite(user); });
    },
    onOut: function () { $("page").hidden = true; closeSheet(); }
  });

  function showSite(user) {
      $("page").hidden = false;
      AD30.track("page_view");
      setupAccount(user);
      var status = $("vidStatus");
      status.textContent = "Loading videos…";
      AD30.loadVideos().then(function (s) {
        attach(s.videos); render();
        var n = s.videos.length;
        if (s.error === "no-sheet") status.textContent = "";
        else if (s.error && s.fromCache) status.textContent = "Showing the saved video list (couldn’t refresh just now).";
        else if (s.error) status.textContent = "Couldn’t load the video list right now. Please try again later.";
        else status.textContent = n ? "" : "";
        window.__ad30sheet = s;
        var h = decodeURIComponent(location.hash.slice(1));
        if (/access_token|error_code/.test(h)) h = "";
        if (!h) { try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {} }
        var want = h || LS.get("ad30m.deeplink", "");
        LS.del("ad30m.deeplink");
        if (want) openFromId(want);
      });
      tipOnce();
  }

  /* ---------- one-time "Add to Home Screen" tip (iPhone/iPad Safari only) ---------- */
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

  window.__openSheet = openSheet; window.__closeSheet = closeSheet; window.__cards = function () { return CARDS; };
})();
