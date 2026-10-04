/* AD30 members - shared code: config, sign-in gate, video sheet, KJV guard, event logging.
   Plain ES5-style JavaScript so it runs on older iPhones without a build step. */
(function () {
  "use strict";
  var C = window.AD30_CONFIG || {};
  var AD30 = (window.AD30 = { cfg: C });
  var $ = (AD30.$ = function (id) { return document.getElementById(id); });

  function isSet(v) { return typeof v === "string" && /\S/.test(v) && !/^PASTE_|YOUR[-_]/i.test(v); }
  AD30.configured = isSet(C.SUPABASE_URL) && isSet(C.SUPABASE_ANON_KEY);
  AD30.sheetConfigured = isSet(C.SHEET_CSV_URL);
  var qs = {};
  try { location.search.slice(1).split("&").forEach(function (p) { if (p) qs[decodeURIComponent(p.split("=")[0])] = decodeURIComponent(p.split("=")[1] || ""); }); } catch (e) {}
  AD30.qs = qs;
  // Demo/preview mode only exists while the site is NOT connected (so it can't bypass sign-in later).
  AD30.demo = !AD30.configured && ("demo" in qs);

  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  AD30.LS = LS;

  /* ---------------- referral code (?ref=CODE), first touch ---------------- */
  // The FIRST code this browser ever arrives with is kept (later links don't overwrite it).
  // It is sent with the sign-up request and stored on the member by the database.
  (function () {
    var raw = String(qs.ref || "").trim().toUpperCase();
    if (/^[A-Z0-9_-]{2,40}$/.test(raw) && !LS.get("ad30m.ref", null)) LS.set("ad30m.ref", { code: raw, at: Date.now() });
    if ("ref" in qs) {   // tidy the address bar so shared links don't carry someone else's code
      try { history.replaceState(null, "", location.pathname + location.search.replace(/([?&])ref=[^&]*&?/, "$1").replace(/[?&]$/, "") + location.hash); } catch (e) {}
    }
  })();
  AD30.refCode = function () { var r = LS.get("ad30m.ref", null); return r && r.code ? r.code : ""; };
  AD30.isAdminEmail = function (email) {
    var list = (C.ADMIN_EMAILS || []).map(function (x) { return String(x).trim().toLowerCase(); });
    return !!email && list.indexOf(String(email).toLowerCase()) >= 0;
  };
  // [simple-rework] Is this signed-in person a group leader (teacher)? Same two checks the site already uses:
  // the ADMIN_EMAILS list in config.js, then the database's own admins table (rpc am_i_admin). Resolves true/false,
  // never fails (no answer within 8 s = false). NOTE: this only decides what the PAGES show (teacher view vs member
  // view); it is not security. Real protection of data is the database's row-level security.
  AD30.checkAdmin = function (user) {
    if (AD30.demo) return Promise.resolve(true);
    if (user && AD30.isAdminEmail(user.email)) return Promise.resolve(true);
    if (!AD30.sb || !user) return Promise.resolve(false);
    return new Promise(function (resolve) {
      var done = false, fin = function (v) { if (!done) { done = true; clearTimeout(t); resolve(v); } };
      var t = setTimeout(function () { fin(false); }, 8000);
      AD30.sb.rpc("am_i_admin").then(function (r) { fin(!!(r && r.data === true)); }, function () { fin(false); });
    });
  };

  /* ---------------- Supabase client ---------------- */
  AD30.sb = null;
  AD30.loadError = "";
  if (AD30.configured) {
    if (window.supabase && window.supabase.createClient) {
      try {
        AD30.sb = window.supabase.createClient(C.SUPABASE_URL.replace(/\/+$/, ""), C.SUPABASE_ANON_KEY, {
          auth: { flowType: "implicit", detectSessionInUrl: true, persistSession: true, autoRefreshToken: true, storageKey: "ad30m.auth" }
        });
      } catch (e) { AD30.loadError = "Sign-in setup error: " + e.message; }
    } else {
      AD30.loadError = "Couldn't load the sign-in library. Check your internet connection and reload.";
    }
  }

  /* ---------------- CSV ---------------- */
  AD30.parseCSV = function (text) {
    var rows = [], row = [], f = "", q = false, i = 0, c;
    text = String(text || "").replace(/^\uFEFF/, "");
    for (; i < text.length; i++) {
      c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
        else f += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(f); f = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(f); rows.push(row); row = []; f = "";
      } else f += c;
    }
    if (f !== "" || row.length) { row.push(f); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return /\S/.test(x); }); });
  };

  // Column names are matched loosely so Sam can rename headers a little.
  var COLS = [
    ["notified", /notif|announc|emailed/], ["published", /publish|^live$|^show/], ["link", /youtube|link|url/],
    ["verse", /text/], ["ref", /ref|scripture|verse/], ["title", /title|name/], ["marker", /marker|feast|card/],
    ["date", /date|when/], ["notes", /note/]
  ];
  function mapHeader(h) {
    var map = {};
    h.forEach(function (name, idx) {
      var k = String(name).toLowerCase().replace(/[^a-z0-9]/g, "");
      for (var j = 0; j < COLS.length; j++) if (COLS[j][1].test(k) && !(COLS[j][0] in map)) { map[COLS[j][0]] = idx; break; }
    });
    return map;
  }

  AD30.youtubeId = function (url) {
    var s = String(url || "").trim();
    if (/^[\w-]{11}$/.test(s)) return s;
    var m = s.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/|v\/))([\w-]{11})/i);
    return m ? m[1] : null;
  };
  function isMp4(url) { return /^(https:\/\/|\/)[^\s]+\.mp4(\?[^\s]*)?$/i.test(String(url || "").trim()); }
  AD30.truthy = function (v) { return /^(y|yes|true|1|x|✓|✔|published|live|on)$/i.test(String(v || "").trim()); };
  AD30.falsy = function (v) { return /^(|n|no|false|0|draft|off|hidden)$/i.test(String(v || "").trim()); };

  /* ---------------- KJV guard ---------------- */
  var KJV = window.AD30_KJV || {};
  var refIndex = {};
  function refKey(r) {
    return String(r || "").toLowerCase().replace(/\(?\bkjv\b\)?/g, "").replace(/[\u2013\u2014]/g, "-")
      .replace(/\s*([:\-])\s*/g, "$1").replace(/\s+/g, " ").replace(/[.\s]+$/, "").trim();
  }
  Object.keys(KJV).forEach(function (r) { refIndex[refKey(r)] = r; });
  AD30.kjv = function (ref) { var r = refIndex[refKey(ref)]; return r ? { ref: r, text: KJV[r] } : null; };
  function looseText(t) { return String(t || "").toLowerCase().replace(/[^a-z]/g, ""); }

  /* ---------------- Video sheet ---------------- */
  // Turns the sheet (CSV text) into rows with checks. Only rows marked published AND with a
  // working link become videos on the site.
  AD30.readSheet = function (text) {
    var all = AD30.parseCSV(text), out = { rows: [], videos: [], headerOk: false, missingCols: [] };
    if (!all.length) return out;
    var map = mapHeader(all[0]);
    ["title", "link", "published"].forEach(function (k) { if (!(k in map)) out.missingCols.push(k); });
    out.headerOk = !out.missingCols.length;
    var seen = {};
    for (var i = 1; i < all.length; i++) {
      var r = all[i], g = function (k) { return k in map ? String(r[map[k]] || "").trim() : ""; };
      var v = { row: i + 1, date: g("date"), marker: g("marker"), title: g("title"), ref: g("ref"),
                sheetVerse: g("verse"), link: g("link"), publishedRaw: g("published"), notified: g("notified"),
                issues: [], verse: "", verseFrom: "" };
      v.published = AD30.truthy(v.publishedRaw);
      if (!AD30.truthy(v.publishedRaw) && !AD30.falsy(v.publishedRaw)) v.issues.push("“published” should be yes or no");
      var yt = AD30.youtubeId(v.link);
      if (yt) { v.kind = "youtube"; v.vid = yt; v.key = yt; }
      else if (isMp4(v.link)) { v.kind = "mp4"; v.vid = v.link; v.key = "mp4-" + v.link.split("/").pop().replace(/\.mp4.*$/i, "").replace(/[^\w-]/g, "").slice(0, 60); }
      else if (v.link) v.issues.push("link isn’t a YouTube video link");
      else if (v.published) v.issues.push("published but no YouTube link yet");
      if (!v.title) v.issues.push("no title");
      var dup = !!(v.key && seen[v.key]);
      if (dup) v.issues.push("same video as row " + seen[v.key] + " (only the first one shows)");
      if (v.key && !seen[v.key] && v.published) seen[v.key] = v.row;
      if (v.ref) {
        var k = AD30.kjv(v.ref);
        if (k) {
          v.ref = k.ref; v.verse = k.text; v.verseFrom = "kjv";
          if (v.sheetVerse && looseText(v.sheetVerse) !== looseText(k.text))
            v.issues.push("verse text differs from the checked KJV for " + k.ref + " (site shows the checked KJV)");
        } else if (v.sheetVerse) {
          v.verse = v.sheetVerse.replace(/^[\s"“”]+|[\s"“”]+$/g, ""); v.verseFrom = "sheet";
          v.issues.push("note: " + v.ref + " isn’t in the built-in KJV list — please double-check the wording is KJV");
        } else v.issues.push("verse reference given but no verse text");
      } else if (v.sheetVerse) v.issues.push("verse text given but no reference");
      out.rows.push(v);
      v.onSite = v.published && !!v.key && !!v.title && !dup;
      if (v.onSite) out.videos.push(v);
    }
    return out;
  };

  function fetchText(url, ms) {
    return new Promise(function (resolve, reject) {
      var ctl = window.AbortController ? new AbortController() : null;
      var t = setTimeout(function () { if (ctl) ctl.abort(); reject(new Error("timeout")); }, ms || 12000);
      fetch(url, { cache: "no-store", signal: ctl ? ctl.signal : undefined, credentials: "omit" })
        .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
        .then(function (t2) { clearTimeout(t); resolve(t2); }, function (e) { clearTimeout(t); reject(e); });
    });
  }

  // Resolves to { rows, videos, fromCache, savedAt, error }
  AD30.loadVideos = function () {
    var url = AD30.demo ? "sample-videos.csv" : (AD30.sheetConfigured ? C.SHEET_CSV_URL : "");
    if (!url) return Promise.resolve({ rows: [], videos: [], error: "no-sheet" });
    var bust = (url.indexOf("?") >= 0 ? "&" : "?") + "_=" + Math.floor(Date.now() / 60000);
    return fetchText(url + bust).then(function (txt) {
      if (/^\s*<!doctype html|^\s*<html/i.test(txt)) throw new Error("got a web page, not CSV (check the published link ends in output=csv)");
      var s = AD30.readSheet(txt);
      if (!s.headerOk) throw new Error("sheet is missing column(s): " + s.missingCols.join(", "));
      LS.set("ad30m.sheet", { text: txt, at: Date.now() });
      s.fromCache = false; return s;
    }).catch(function (e) {
      var c = LS.get("ad30m.sheet", null);
      if (c && c.text) { var s = AD30.readSheet(c.text); s.fromCache = true; s.savedAt = c.at; s.error = String(e.message || e); return s; }
      return { rows: [], videos: [], error: String(e.message || e) };
    });
  };

  /* ---------------- engagement log ---------------- */
  AD30.session = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
  AD30.user = null;
  window.__ad30events = [];
  var QKEY = "ad30m.queue";
  function clean(row) {
    var o = {};
    Object.keys(row).forEach(function (k) {
      var v = row[k]; if (v === undefined || v === null || v === "") return;
      o[k] = typeof v === "string" ? v.slice(0, k === "user_agent" ? 300 : 200) : v;
    });
    return o;
  }
  function isNetErr(err) { return !err || /fetch|network|load failed|timeout/i.test(String(err.message || err)); }
  AD30.track = function (kind, f) {
    f = f || {};
    var row = clean({ kind: kind, page: location.pathname, session_id: AD30.session,
      user_agent: (navigator.userAgent || "").slice(0, 300), marker_id: f.marker_id, video_id: f.video_id,
      video_title: f.video_title, progress_pct: typeof f.progress_pct === "number" ? Math.max(0, Math.min(100, Math.round(f.progress_pct))) : undefined });
    window.__ad30events.push(row);
    // [simple-rework] returns a promise (settles when the event is saved or queued) so index.html can wait for
    // the sign_in event before sending a member on to the member view.
    if (AD30.demo) { if (window.console) console.info("[demo] would log", row); return Promise.resolve(); }
    if (!AD30.sb || !AD30.user) return Promise.resolve();
    return AD30.sb.from("events").insert(row).then(function (res) {
      if (res.error) {
        if (isNetErr(res.error)) { var q = LS.get(QKEY, []); q.push(row); LS.set(QKEY, q.slice(-200)); }
        else if (window.console) console.warn("event not saved:", res.error.message);
      }
    }, function () { var q = LS.get(QKEY, []); q.push(row); LS.set(QKEY, q.slice(-200)); });
  };
  AD30.flushQueue = function () {
    var q = LS.get(QKEY, []);
    if (!q.length || !AD30.sb || !AD30.user) return;
    LS.del(QKEY);
    AD30.sb.from("events").insert(q).then(function (res) { if (res.error && isNetErr(res.error)) LS.set(QKEY, q); });
  };

  /* ---------------- sign-in gate ---------------- */
  function friendlyError(err) {
    var m = String((err && (err.message || err.msg || err.error_description)) || err || "");
    var st = err && err.status;
    if (/AD30_NOT_INVITED|database error saving new user|not.*invited|signups? not allowed/i.test(m))
      return "That email isn’t on the study-group list yet. Ask " + (C.CONTACT_NAME || "the group leader") + " to add it, then try again.";
    if (/email address not authorized/i.test(m))
      return "The site’s email sender isn’t switched on yet (Supabase custom SMTP). Please tell Sam or Ben.";
    var sec = m.match(/after (\d+) seconds?/i);
    if (sec) return "Please wait " + sec[1] + " seconds before asking for another email.";
    if (st === 429 || /rate limit|too many/i.test(m)) return "Too many sign-in emails were sent just now. Please wait a few minutes and try again.";
    if (/unable to validate email|invalid.*email|email.*invalid/i.test(m)) return "That doesn’t look like an email address. Please check it.";
    if (/expired|invalid|otp/i.test(m)) return "That code didn’t work or has expired. Use the newest email, or send a new one.";
    if (/fetch|network|load failed/i.test(m)) return "Couldn’t reach the sign-in service. Check your connection and try again.";
    return "Something went wrong: " + m;
  }
  AD30.friendlyError = friendlyError;

  function readHashParams() {
    var h = (location.hash || "").slice(1), o = {};
    if (!/(^|&)(access_token|error|error_code)=/.test(h)) return null;
    h.split("&").forEach(function (p) { var kv = p.split("="); o[decodeURIComponent(kv[0])] = decodeURIComponent((kv[1] || "").replace(/\+/g, " ")); });
    return o;
  }

  // opts: { onIn(user, how), onOut() }. Gate markup ids: gate, gForm, gEmail, gSend, gCodeForm, gCode,
  // gVerify, gMsg, gResend, gBack, gSetup, gSentTo, gDemo
  AD30.startAuth = function (opts) {
    var gate = $("gate"), started = false;
    var hp = readHashParams();
    // Save a deep link (e.g. #v-abc123 from an email) so we can open it after sign-in.
    if (!hp && location.hash.length > 1) LS.set("ad30m.deeplink", location.hash.slice(1));
    function msg(text, kind) { var el = $("gMsg"); el.textContent = text || ""; el.className = "msg" + (kind ? " " + kind : ""); }
    function show() { gate.hidden = false; document.documentElement.classList.remove("signed-in"); }
    function hide() { gate.hidden = true; document.documentElement.classList.add("signed-in"); }
    function signedIn(user, how) {
      if (started) return; started = true; AD30.user = user; hide();
      LS.del("ad30m.pending");
      setTimeout(function () { AD30.flushQueue(); opts.onIn(user, how); }, 0);
    }
    function step(which) {
      $("gForm").hidden = which !== "email"; $("gCodeForm").hidden = which !== "code";
      if (which === "code") setTimeout(function () { try { $("gCode").focus(); } catch (e) {} }, 50);
    }

    if (AD30.demo) { signedIn({ email: "demo@example.com", id: "demo" }, "demo"); return; }
    show(); step("email");
    if (!AD30.configured) {
      $("gSetup").hidden = false;
      $("gForm").addEventListener("submit", function (e) {
        e.preventDefault();
        msg("This copy of the site isn’t connected yet — js/config.js still has placeholders (see SETUP.md).", "err");
      });
      return;
    }
    if (!AD30.sb) { msg(AD30.loadError, "err"); $("gSend").disabled = true; return; }
    if (hp && (hp.error || hp.error_code)) {
      var d = hp.error_description || hp.error;
      msg(/expired|invalid/i.test(d + hp.error_code) ? "That sign-in link has expired or was already used. Send a new one below — or type the code from the email." : friendlyError(d), "err");
      try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
    }

    var email = "", lastSend = 0;
    var pend = LS.get("ad30m.pending", null);
    if (pend && pend.email && Date.now() - pend.at < 3600e3) { email = pend.email; $("gEmail").value = email; $("gSentTo").textContent = email; step("code"); }

    function send() {
      var addr = ($("gEmail").value || "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) { msg("Please enter your email address.", "err"); return; }
      var btn = $("gSend"); btn.disabled = true; btn.textContent = "Sending…"; msg("");
      var here = location.origin + location.pathname;
      var ref = AD30.refCode(), o = { emailRedirectTo: /^https?:/.test(here) ? here : C.SITE_URL, shouldCreateUser: true };
      if (ref) o.data = { ref: ref };   // lands in auth user_metadata on first sign-up only (first touch)
      AD30.sb.auth.signInWithOtp({ email: addr, options: o })
        .then(function (res) {
          btn.disabled = false; btn.textContent = "Email me a sign-in link";
          if (res.error) { msg(friendlyError(res.error), "err"); return; }
          email = addr; lastSend = Date.now(); LS.set("ad30m.pending", { email: addr, at: lastSend });
          $("gSentTo").textContent = addr; step("code");
          msg("Sent! Open the email on this device and tap the link — or type the code here.", "ok");
        }, function (err) { btn.disabled = false; btn.textContent = "Email me a sign-in link"; msg(friendlyError(err), "err"); });
    }
    $("gForm").addEventListener("submit", function (e) { e.preventDefault(); send(); });
    $("gCodeForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var code = ($("gCode").value || "").replace(/\D/g, "");
      if (code.length < 6) { msg("Type the code from the email (6 or more digits).", "err"); return; }
      var b = $("gVerify"); b.disabled = true; b.textContent = "Checking…";
      AD30.sb.auth.verifyOtp({ email: email, token: code, type: "email" }).then(function (res) {
        b.disabled = false; b.textContent = "Sign in";
        if (res.error) { msg(friendlyError(res.error), "err"); return; }
        if (res.data && res.data.session) signedIn(res.data.session.user, "code");
      }, function (err) { b.disabled = false; b.textContent = "Sign in"; msg(friendlyError(err), "err"); });
    });
    $("gResend").addEventListener("click", function () {
      var wait = 60 - Math.round((Date.now() - lastSend) / 1000);
      if (lastSend && wait > 0) { msg("You can ask for another email in " + wait + " seconds.", "err"); return; }
      $("gEmail").value = email; send();
    });
    $("gBack").addEventListener("click", function () { LS.del("ad30m.pending"); msg(""); step("email"); try { $("gEmail").focus(); } catch (e) {} });

    AD30.sb.auth.onAuthStateChange(function (event, session) {
      if (session && session.user) signedIn(session.user, hp && hp.access_token ? "link" : (event === "SIGNED_IN" ? "link" : "session"));
      else if (event === "SIGNED_OUT") { started = false; AD30.user = null; show(); step("email"); if (opts.onOut) opts.onOut(); }
    });
  };

  AD30.signOut = function () {
    if (AD30.demo) { location.href = location.pathname; return; }
    if (AD30.sb) AD30.sb.auth.signOut().then(function () { location.replace(location.pathname); });
  };

  AD30.esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
})();
