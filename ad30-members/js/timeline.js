/* AD30 members - the full interactive timeline (index.html).
   Same behaviour as the public /ad30-timeline/ page (filter chips, tap a marker to open it,
   Open all / Close all, #marker deep links, the three RL7.1a video players), plus:
   the sign-in gate, engagement logging (page view, marker opened, video play/25/50/75/complete),
   videos from Sam's Google Sheet attached to the matching timeline marker, and the account box. */
(function () {
  "use strict";
  var AD30 = window.AD30, $ = AD30.$, LS = AD30.LS, esc = AD30.esc;
  var bar = document.querySelector(".bar"), allBtn = $("all");
  var RM = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var started = false;

  // [hotfix-cd] 10 Nisan countdown - Teacher view only (removed from the member view, Oct 4 2026).
  // 10 Nisan 5790 begins at sunset in Jerusalem on Fri Apr 12, 2030 (19:07 IDT). Same target/label as the old member countdown.
  (function () {
    var d = $("cdD"); if (!d) return;
    var target = new Date("2030-04-12T19:07:00+03:00").getTime();
    $("cdWhen").textContent = "10 Nisan · Sat Apr 13, 2030";
    function tick() {
      var ms = Math.max(0, target - Date.now()), totalMin = Math.floor(ms / 60000);
      d.textContent = Math.floor(totalMin / 1440).toLocaleString("en-US");
      $("cdH").textContent = Math.floor((totalMin % 1440) / 60);
      var m = totalMin % 60; $("cdM").textContent = m < 10 ? "0" + m : m;
    }
    tick(); setInterval(tick, 15000);
  })();

  /* ================= timeline behaviour (ported unchanged from /ad30-timeline/) ================= */
  function bh() { document.documentElement.style.setProperty("--barh", bar.offsetHeight + "px"); }
  bh(); window.addEventListener("resize", bh);
  var on = { T: true, G: true, I: true, C: true, V: true };
  function apply() {
    document.querySelectorAll(".ln").forEach(function (l) { if (l.dataset.t) l.classList.toggle("hide", !on[l.dataset.t]); });
    document.querySelectorAll(".ev").forEach(function (e) {
      var tags = (e.dataset.tags || "").split(" "), p = e.dataset.place, any = on[p] || tags.some(function (t) { return on[t]; });
      e.classList.toggle("hide", !any); e.classList.toggle("dim", any && !on[p]);
    });
    document.querySelectorAll(".gap").forEach(function (g) { g.classList.toggle("hide", !(on.G && on.I)); });
  }
  document.querySelectorAll(".chip").forEach(function (c) {
    c.addEventListener("click", function () { var k = c.dataset.k; on[k] = !on[k]; c.setAttribute("aria-pressed", on[k]); apply(); });
  });
  // quiet = true for "Open all" (logged once as marker "all", not 34 times)
  function setOpen(li, o, quiet) {
    var b = li.querySelector("button.hd"), d = li.querySelector(".body"); if (!b || !d) return;
    var was = li.classList.contains("open");
    b.setAttribute("aria-expanded", o); d.hidden = !o; li.classList.toggle("open", o);
    if (!o) {
      d.querySelectorAll("video").forEach(function (v) { try { v.pause(); } catch (_) {} });
      pauseYT(li);
      (li._trackers || []).forEach(function (t) { t.played = false; });   // re-opening + playing again counts as a new play
    } else {
      mountYT(li);
      if (!was && !quiet) AD30.track("card_open", { marker_id: li.id });
    }
  }
  function scrollToEl(el) {
    var y = el.getBoundingClientRect().top + window.scrollY - (bar.offsetHeight + 44);
    window.scrollTo({ top: Math.max(0, y), behavior: RM ? "auto" : "smooth" });
  }
  document.addEventListener("click", function (ev) {
    if (!ev.target.closest) return;
    var a = ev.target.closest("a[data-watch]");
    if (a) {
      var li = document.getElementById(a.dataset.watch); if (!li) return;
      ev.preventDefault(); li.classList.remove("hide"); setOpen(li, true);
      scrollToEl(li.querySelector(".vid") || li);
      var vv = li.querySelector("video"); if (vv) { try { vv.focus({ preventScroll: true }); } catch (_) {} }
      return;
    }
    var b = ev.target.closest(".ev > button.hd");   // delegated, so Sheet-only markers work too
    if (b) { var li2 = b.parentNode; setOpen(li2, !li2.classList.contains("open")); }
  });
  allBtn.addEventListener("click", function () {
    var o = allBtn.dataset.o !== "1";
    document.querySelectorAll(".ev").forEach(function (li) { setOpen(li, o, true); });
    allBtn.dataset.o = o ? "1" : "0"; allBtn.textContent = o ? "Close all" : "Open all";
    if (o) AD30.track("card_open", { marker_id: "all" });
  });

  /* ================= toast ================= */
  var toastEl = $("toast"), toastT = null;
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove("show"); }, 2200); }

  /* ================= watched marks (this device) ================= */
  var watched = LS.get("ad30t.watched", {});
  function markWatched(id) { if (!id) return; watched[id] = 1; LS.set("ad30t.watched", watched); var li = document.getElementById(id); if (li) li.classList.add("watched"); }
  function paintWatched() { Object.keys(watched).forEach(function (id) { var li = document.getElementById(id); if (li) li.classList.add("watched"); }); }

  /* ================= video tracking ================= */
  function mp4Key(src) { return "mp4-" + String(src || "").split("/").pop().replace(/\.mp4.*$/i, "").replace(/[^\w-]/g, "").slice(0, 60); }
  var sent = {};   // per page-load: milestones already logged, per video (the 3 RL7.1a players share one video id)
  function tracker(li, key, title) {
    var s = sent[key] || (sent[key] = { m: {}, complete: false });
    var base = { marker_id: li.id, video_id: key, video_title: title };
    function f(x) { return Object.assign({}, base, x || {}); }
    var t = {
      played: false,
      play: function () { if (!t.played) { t.played = true; AD30.track("video_play", f()); } },
      progress: function (cur, dur) {
        if (!dur || !isFinite(dur)) return;
        var pct = (cur / dur) * 100;
        [25, 50, 75].forEach(function (m) { if (pct >= m && !s.m[m]) { s.m[m] = 1; AD30.track("video_progress", f({ progress_pct: m })); } });
        if (pct >= 90) t.complete();
      },
      complete: function () {
        if (!s.complete) { s.complete = true; AD30.track("video_complete", f({ progress_pct: 100 })); }
        markWatched(li.id);
      }
    };
    (li._trackers || (li._trackers = [])).push(t);
    return t;
  }
  function wireVideo(vid, li, key, title) {
    if (vid._ad30) return; vid._ad30 = true;
    var t = tracker(li, key, title);
    vid.addEventListener("play", function () {
      t.play();
      document.querySelectorAll("video").forEach(function (o) { if (o !== vid) try { o.pause(); } catch (_) {} });   // one lesson at a time
    });
    vid.addEventListener("timeupdate", function () { t.progress(vid.currentTime, vid.duration); });
    vid.addEventListener("ended", function () { t.complete(); });
  }
  // the three built-in players (RL7.1a "The Water", /videos/rl71a-the-water.mp4)
  document.querySelectorAll(".ev figure.vid video").forEach(function (vid) {
    var li = vid.closest(".ev"), srcEl = vid.querySelector("source"), src = (srcEl && srcEl.getAttribute("src")) || vid.getAttribute("src") || "";
    var key = mp4Key(src), fig = vid.closest("figure");
    if (fig) fig.setAttribute("data-key", key);
    wireVideo(vid, li, key, vid.getAttribute("aria-label") || (fig && fig.textContent) || "Video");
    badge(li);
  });

  /* ---------- YouTube (Sheet videos) ---------- */
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
  function mountYT(li) {
    li.querySelectorAll(".sheetvid[data-yt]").forEach(function (fig) {
      if (fig._mounted) return; fig._mounted = true;
      var holder = fig.querySelector(".ytbox"), inner = holder.firstElementChild, t = tracker(li, fig.dataset.key, fig.dataset.title);
      loadYT().then(function (YT) {
        if (!inner.isConnected) return;
        fig._p = new YT.Player(inner, {
          videoId: fig.dataset.yt, host: "https://www.youtube-nocookie.com", width: "100%", height: "100%",
          playerVars: { playsinline: 1, rel: 0, modestbranding: 1, origin: location.origin },
          events: {
            onStateChange: function (e) {
              var p = e.target;
              if (e.data === 1) {
                t.play(); clearInterval(fig._poll);
                document.querySelectorAll("video").forEach(function (o) { try { o.pause(); } catch (_) {} });
                fig._poll = setInterval(function () { try { t.progress(p.getCurrentTime(), p.getDuration()); } catch (x) {} }, 2000);
              } else if (e.data === 2) { clearInterval(fig._poll); try { t.progress(p.getCurrentTime(), p.getDuration()); } catch (x) {} }
              else if (e.data === 0) { clearInterval(fig._poll); t.complete(); }
            }
          }
        });
      }).catch(function () {
        // YouTube API blocked: a plain embed still plays, we just can't see progress.
        var f = document.createElement("iframe");
        f.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(fig.dataset.yt) + "?playsinline=1&rel=0";
        f.title = fig.dataset.title; f.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen";
        f.setAttribute("allowfullscreen", ""); holder.innerHTML = ""; holder.appendChild(f);
      });
    });
  }
  function pauseYT(li) {
    li.querySelectorAll(".sheetvid[data-yt]").forEach(function (fig) {
      clearInterval(fig._poll);
      if (fig._p && fig._p.pauseVideo) try { fig._p.pauseVideo(); } catch (_) {}
    });
    if (window.AD30L && window.AD30L.stopDrive) try { window.AD30L.stopDrive(li); } catch (_) {}   // [drive-resources] Google Drive lesson videos
  }

  /* ================= Sheet videos -> timeline markers ================= */
  function norm(s) { return String(s || "").toLowerCase().replace(/[“”"’']/g, "").replace(/[^a-z0-9]+/g, " ").trim(); }
  // Words Sam can type in the Sheet's "marker" column. The simple-view names (Birth, Jordan,
  // Tabernacles, Passover, Resurrection, Pentecost) keep working; any timeline marker id
  // (e.g. jn737, tab29, cross) or its exact title also works. Blank/unknown -> "More videos".
  var ALIAS = {
    "birth": "birth", "nativity": "birth", "trumpets": "birth",
    "jordan": "jordan", "the jordan": "jordan", "baptism": "jordan",
    "tabernacles": "jn737", "sukkot": "jn737", "booths": "jn737", "that great day": "jn737", "last great day": "jn737", "living water": "jn737",
    "feast of tabernacles": "tab29",
    "dedication": "ded29", "hanukkah": "ded29", "chanukah": "ded29",
    "entry": "entry", "triumphal entry": "entry", "palm sunday": "entry",
    "last supper": "jn131",
    "passover": "cross", "the cross": "cross", "cross": "cross", "crucifixion": "cross", "passover the cross": "cross",
    "burial": "jn1942",
    "resurrection": "three", "he is risen": "three", "risen": "three", "firstfruits": "three", "first fruits": "three",
    "empty tomb": "jn201", "thomas": "jn2026",
    "ascension": "asc",
    "pentecost": "pent", "shavuot": "pent", "weeks": "pent"
  };
  var byTitle = {};
  document.querySelectorAll(".ev").forEach(function (li) { var t = li.querySelector(".ttl"); if (t) byTitle[norm(t.textContent)] = li; });
  function findEvent(marker) {
    var raw = String(marker || "").trim(), k = norm(raw); if (!k) return null;
    var el = document.getElementById(raw) || document.getElementById(raw.toLowerCase());
    if (el && el.classList.contains("ev") && !el.classList.contains("sv")) return el;
    if (ALIAS[k]) return document.getElementById(ALIAS[k]);
    return byTitle[k] || null;
  }
  function sheetFigure(v, li) {
    var fig = document.createElement("figure");
    fig.className = "vid sheetvid"; fig.id = "sv-" + v.key; fig.setAttribute("data-key", v.key); fig.setAttribute("data-title", v.title);
    var h = '<figcaption><span class="hasv">▶ WATCH</span>' + esc(v.title) + "</figcaption>";
    if (v.kind === "youtube") { fig.setAttribute("data-yt", v.vid); h += '<div class="ytbox"><div></div></div>'; }
    else h += '<video controls playsinline preload="metadata"></video>';
    if (v.verse && li && [].some.call(li.querySelectorAll(".body .ref"), function (r) { return r.textContent.trim() === String(v.ref).trim(); })) { /* verse already shown on this marker */ }
    else if (v.verse && v.verseFrom === "kjv")
      h += '<div class="ln lT" data-t="T"><span class="tag kT">TEXT</span><span class="ref">' + esc(v.ref) + '</span> <span class="q">“' + esc(v.verse) + '”</span></div>';
    else if (v.verse)
      h += '<div class="ln"><span class="ref">' + esc(v.ref) + '</span> <span class="q">“' + esc(v.verse) + '”</span> <span class="sm">(KJV, as typed in the video list)</span></div>';
    fig.innerHTML = h;
    if (v.kind !== "youtube") { var vid = fig.querySelector("video"); vid.src = v.vid; vid.setAttribute("title", v.title); }
    return fig;
  }
  function badge(li) {
    var pv = li.querySelector(".pv"); if (!pv || pv.querySelector(".hasv")) return;
    var s = document.createElement("span"); s.className = "hasv"; s.textContent = "▶ WATCH"; pv.insertBefore(s, pv.firstChild);
  }
  function attachSheet(videos) {
    var more = $("sheetList"), extra = 0;
    videos.forEach(function (v) {
      if (document.getElementById("sv-" + v.key) || document.querySelector('.vid[data-key="' + v.key + '"]')) return;   // already on the page
      var li = findEvent(v.marker), fig = sheetFigure(v, li);
      if (!li) {
        li = document.createElement("li");
        li.className = "ev sv"; li.id = "e-" + v.key; li.setAttribute("data-place", "V"); li.setAttribute("data-tags", "V");
        li.innerHTML = '<span class="dot kV"></span><button class="hd" aria-expanded="false" aria-controls="b-e-' + esc(v.key) + '">' +
          '<span class="dt">' + esc(v.date || "New video") + '</span><span class="ttl">' + esc(v.title) + '</span>' +
          '<span class="meta"><span class="pv">' + esc(v.ref || (v.marker ? v.marker : "")) + '</span><span class="chev">▾</span></span></button>' +
          '<div class="body" id="b-e-' + esc(v.key) + '" hidden></div>';
        more.appendChild(li); extra++;
        li.querySelector(".body").appendChild(fig);
      } else {
        var body = li.querySelector(".body"), figs = body.querySelectorAll("figure.vid");
        if (figs.length) figs[figs.length - 1].insertAdjacentElement("afterend", fig); else body.insertBefore(fig, body.firstChild);
      }
      badge(li);
      var vid = fig.querySelector("video"); if (vid) wireVideo(vid, li, v.key, v.title);
      if (li.classList.contains("open")) mountYT(li);
    });
    if (extra) $("sheetMore").hidden = false;
    apply(); paintWatched();
  }

  /* ================= deep links: #marker-id, #v-<videoKey>, #all, simple-view names ================= */
  function resolve(id) {
    if (!id) return null;
    if (id === "all") return { all: true };
    var el = document.getElementById(id);
    if (el && el.classList.contains("ev")) return { li: el, focus: el };
    if (id.indexOf("v-") === 0) {
      var key = id.slice(2).replace(/[^\w-]/g, "");
      var fig = document.getElementById("sv-" + key) || document.querySelector('.vid[data-key="' + key + '"]');
      if (fig) return { li: fig.closest(".ev"), focus: fig };
    }
    var a = ALIAS[norm(id)];
    if (a && $(a)) return { li: $(a), focus: $(a) };
    return null;
  }
  function openTarget(id) {
    var r = resolve(id); if (!r) return false;
    if (r.all) { if (allBtn.dataset.o !== "1") allBtn.click(); return true; }
    r.li.classList.remove("hide"); setOpen(r.li, true);
    setTimeout(function () { scrollToEl(r.focus); }, 40);
    return true;
  }
  window.addEventListener("hashchange", function () { if (started) openTarget(decodeURIComponent(location.hash.slice(1))); });

  /* ================= account box ================= */
  function showAdmin() { $("adminWrap").hidden = false; $("adminTop").hidden = false; }
  function setupAccount(user) {
    $("whoami").textContent = user.email || "";
    $("signOut").addEventListener("click", AD30.signOut);
    var box = $("notifyBox"), cb = $("notify");
    if (AD30.demo) { box.hidden = false; cb.checked = true; cb.addEventListener("change", function () { toast(cb.checked ? "Emails on (demo)" : "Emails off (demo)"); }); showAdmin(); return; }
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
    if (AD30.isAdminEmail(user.email)) showAdmin();
    AD30.sb.rpc("am_i_admin").then(function (r) { if (r.data === true) showAdmin(); });
  }

  /* ================= free window / paywall (enforced only when paywall_enabled = true in the database) ================= */
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

  /* ================= start after sign-in ================= */
  // [simple-rework] This full timeline is the TEACHER view, for group leaders only (AD30.checkAdmin in common.js:
  // ADMIN_EMAILS, then the database's admins table). Everyone else is sent to the member view (simple.html),
  // taking any #link along. This only changes what the page shows: the timeline's text is still in this file's HTML.
  function cover(on) {   // plain "Opening…" screen while we check who is signing in (so nothing flashes)
    var c = $("routing");
    if (!on) { if (c) c.parentNode.removeChild(c); return; }
    if (c) return;
    c = document.createElement("div"); c.id = "routing"; c.setAttribute("role", "status"); c.textContent = "Opening…";
    c.style.cssText = "position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;background:#0e1116;color:#9a9fa8;font:17px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif";
    document.body.appendChild(c);
  }
  function toMemberView(waitFor) {
    var h = location.hash.slice(1); if (/access_token|error_code/.test(h)) h = "";
    var go = function () { location.replace("simple.html" + (h ? "#" + h : "")); };
    // give the sign_in event up to 1.5 s to be saved before leaving the page
    Promise.race([waitFor || Promise.resolve(), new Promise(function (r) { setTimeout(r, 1500); })]).then(go, go);
  }
  AD30.startAuth({
    onIn: function (user, how) {
      if (started) return; started = true;
      cover(true);
      var signInEvt = (how === "link" || how === "code") ? AD30.track("sign_in") : null;
      checkAccess(user).then(function (ok) {
        if (!ok) { cover(false); return; }
        AD30.checkAdmin(user).then(function (isAdmin) {
          if (isAdmin) { cover(false); showSite(user); } else toMemberView(signInEvt);
        });
      });
    },
    onOut: function () { $("page").hidden = true; }
  });

  function showSite(user) {
    $("page").hidden = false; bh(); apply(); paintWatched();
    var tc = document.querySelector('meta[name="theme-color"]'); if (tc) tc.setAttribute("content", "#ffffff");   // light status bar over the light timeline
    AD30.track("page_view");
    setupAccount(user);
    // Video lessons added on the group leader page (js/lessons.js). Any failure here is silent: the page works as before.
    var lessonsDone = Promise.resolve();
    try {
      if (window.AD30L) lessonsDone = window.AD30L.timeline({ setOpen: setOpen, openTarget: openTarget, mountYT: mountYT, badge: badge, apply: apply, paintWatched: paintWatched })
        .catch(function () {});
    } catch (e) {}
    AD30.loadVideos().then(function (s) {
      attachSheet(s.videos || []);
      window.__ad30sheet = s;
      if (s.error && s.error !== "no-sheet" && !s.fromCache) toast("Couldn’t load the new-video list just now");
      var h = decodeURIComponent(location.hash.slice(1));
      if (/access_token|error_code/.test(h)) h = "";
      if (!h) { try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {} }
      var want = h || LS.get("ad30m.deeplink", "");
      LS.del("ad30m.deeplink");
      if (want) lessonsDone.then(function () { openTarget(want); });
    });
  }

  window.__tl = { setOpen: setOpen, openTarget: openTarget, findEvent: findEvent };
})();
