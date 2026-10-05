/* AD30 members - group leader (admin) view.
   Reads the admin_* views. The database returns rows only to emails in its "admins" table;
   AD30_CONFIG.ADMIN_EMAILS only decides what this page shows. */
(function () {
  "use strict";
  var AD30 = window.AD30, $ = AD30.$, esc = AD30.esc;
  var DATA = null;

  function when(ts) {
    if (!ts) return "—";
    var d = new Date(ts), s = (Date.now() - d.getTime()) / 1000, rel;
    if (s < 0) { var days = Math.ceil(-s / 86400); return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) + " (in " + days + " d)"; }
    if (s < 90) rel = "just now"; else if (s < 3600) rel = Math.round(s / 60) + " min ago";
    else if (s < 86400) rel = Math.round(s / 3600) + " h ago"; else rel = Math.round(s / 86400) + " d ago";
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " (" + rel + ")";
  }
  var fWhen = function (v) { return esc(when(v)); };
  var fYes = function (v) { return v === true ? "yes" : v === false ? "no" : "—"; };
  var fPct = function (v) { return v == null ? "—" : esc(v + "%"); };
  var fDate = function (v) { return v ? esc(new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })) : "—"; };

  // cols: [key, label, fmt?, className?]
  function table(el, rows, cols, empty) {
    if (!rows || !rows.length) { el.innerHTML = '<p class="hint" style="padding:12px 14px;margin:0">' + esc(empty || "Nothing yet.") + "</p>"; return; }
    var h = "<table><thead><tr>" + cols.map(function (c) { return "<th>" + esc(c[1]) + "</th>"; }).join("") + "</tr></thead><tbody>";
    rows.forEach(function (r) {
      h += "<tr" + (r._cls ? ' class="' + r._cls + '"' : "") + ">" + cols.map(function (c) {
        var v = c[2] ? c[2](r[c[0]], r) : esc(r[c[0]] == null ? "" : r[c[0]]);
        return '<td class="' + (c[3] || "") + '" data-label="' + esc(c[1]) + '">' + (v === "" ? "" : '<span class="v">' + v + "</span>") + "</td>";
      }).join("") + "</tr>";
    });
    el.innerHTML = h + "</tbody></table>";
  }

  /* ---------- CSV export ---------- */
  function toCSV(rows, cols) {
    var q = function (v) { v = v == null ? "" : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    return [cols.map(function (c) { return q(c[1]); }).join(",")]
      .concat(rows.map(function (r) { return cols.map(function (c) { return q(r[c[0]]); }).join(","); })).join("\n");
  }
  function download(name, text) {
    var blob = new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8" }), a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  /* ---------- column sets (screen + CSV) ---------- */
  var COLS = {
    people: [["email", "Email"], ["status", "Status"], ["last_visit", "Last visit", fWhen], ["visits", "Visits", null, "num"],
      ["days_active", "Days active", null, "num"], ["videos_started", "Videos started", null, "num"], ["videos_completed", "Videos finished", null, "num"],
      ["avg_furthest_pct", "How far (avg)", fPct, "num"], ["last_video", "Last video"], ["referred_by", "Referred by"],
      ["access_until", "Access until", fDate], ["gets_emails", "Emails on", fYes]],
    videos: [["video_title", "Video"], ["people_started", "Viewers", null, "num"], ["people_finished", "Finished", null, "num"],
      ["completion_rate_pct", "Completion rate", fPct, "num"], ["avg_furthest_pct", "Avg how far", fPct, "num"],
      ["total_plays", "Plays", null, "num"], ["last_watched", "Last watched", fWhen]],
    referrers: [["ministry_name", "Ministry"], ["code", "Code"], ["signups", "Sign-ups", null, "num"], ["active_7d", "Active 7 d", null, "num"],
      ["active_30d", "Active 30 d", null, "num"], ["watched_a_video", "Watched a video", null, "num"], ["video_finishes", "Video finishes", null, "num"],
      ["visits", "Visits", null, "num"], ["with_access_now", "In free window", null, "num"], ["last_signup", "Last sign-up", fWhen],
      ["contact_name", "Contact"], ["contact_email", "Contact email/phone"], ["commission_note", "Commission note"], ["link", "Link", function (v) {
        return '<span class="small">' + esc(v) + '</span><br><button class="xbtn copy" type="button" data-copy="' + esc(v) + '">Copy link</button>'; }]],
    watch: [["email", "Email"], ["video_title", "Video"], ["furthest_pct", "Furthest", fPct, "num"], ["finished", "Finished", fYes], ["last_watched", "When", fWhen]],
    recent: [["created_at", "When", fWhen], ["email", "Email"], ["kind", "What"], ["marker_id", "Card"], ["video_title", "Video"], ["progress_pct", "%", fPct, "num"]]
  };
  function siteUrl() { return (AD30.cfg.SITE_URL && !/^PASTE_/.test(AD30.cfg.SITE_URL) ? AD30.cfg.SITE_URL : location.origin + location.pathname.replace(/admin\.html$/, "")).replace(/\/?$/, "/"); }

  /* ---------- data (live or demo) ---------- */
  function demoData() {
    var now = Date.now(), ago = function (h) { return new Date(now - h * 3600e3).toISOString(); };
    var inD = function (d) { return new Date(now + d * 86400e3).toISOString(); };
    return {
      people: [
        { email: "tester1@example.com", status: "signed in", last_visit: ago(2), visits: 6, days_active: 4, videos_started: 2, videos_completed: 1, avg_furthest_pct: 75, last_video: "The Water (17 min)", referred_by: "Grace Chapel", referral_code: "GRACE", access_until: inD(26), gets_emails: true },
        { email: "tester2@example.com", status: "signed in", last_visit: ago(30), visits: 1, days_active: 1, videos_started: 1, videos_completed: 0, avg_furthest_pct: 50, last_video: "The Water (17 min)", referred_by: null, access_until: inD(29), gets_emails: false },
        { email: "friend@example.com", status: "invited, not signed in yet", last_visit: null, visits: 0, days_active: 0, videos_started: 0, videos_completed: 0, avg_furthest_pct: null, last_video: null, gets_emails: null }
      ],
      videos: [{ video_id: "M7lc1UVf-VE", video_title: "The Water (17 min)", people_started: 2, people_finished: 1, completion_rate_pct: 50, avg_furthest_pct: 75, total_plays: 3, last_watched: ago(2) }],
      watch: [{ email: "tester1@example.com", video_title: "The Water (17 min)", furthest_pct: 100, finished: true, last_watched: ago(2) },
              { email: "tester2@example.com", video_title: "The Water (17 min)", furthest_pct: 50, finished: false, last_watched: ago(30) }],
      recent: [{ created_at: ago(2), email: "tester1@example.com", kind: "video_complete", video_title: "The Water (17 min)", marker_id: "tabernacles", progress_pct: 100 },
               { created_at: ago(2.3), email: "tester1@example.com", kind: "page_view", page: "/ad30-members/" }],
      invites: [{ email: "friend@example.com", invited_at: ago(40) }, { email: "tester1@example.com", invited_at: ago(100) }, { email: "tester2@example.com", invited_at: ago(100) }],
      referrers: [{ code: "GRACE", ministry_name: "Grace Chapel", contact_name: "Pat", contact_email: "pat@example.org", commission_note: "TBD", signups: 1, active_7d: 1, active_30d: 1, watched_a_video: 1, video_finishes: 1, visits: 6, with_access_now: 1, last_signup: ago(90) }]
    };
  }
  function q(view, order, limit) {
    var x = AD30.sb.from(view).select("*");
    if (order) x = x.order(order[0], { ascending: !!order[1], nullsFirst: false });
    if (limit) x = x.limit(limit);
    return x.then(function (r) { if (r.error) throw r.error; return r.data; });
  }
  function load() {
    if (AD30.demo) return Promise.resolve(demoData());
    return Promise.all([
      q("admin_engagement", ["last_visit", false]), q("admin_video_stats", ["people_started", false]),
      q("admin_watch_detail", ["last_watched", false], 500), q("admin_recent_activity", ["created_at", false], 100),
      q("invites", ["invited_at", false]), q("admin_referrers", ["signups", false])
    ]).then(function (a) { return { people: a[0], videos: a[1], watch: a[2], recent: a[3], invites: a[4], referrers: a[5] }; });
  }

  function paint(d) {
    DATA = d;
    d.referrers.forEach(function (r) { r.link = siteUrl() + "?ref=" + encodeURIComponent(r.code); });
    var signed = d.people.filter(function (p) { return p.status === "signed in"; });
    var week = signed.filter(function (p) { return p.last_visit && Date.now() - new Date(p.last_visit) < 7 * 86400e3; });
    var watched = signed.filter(function (p) { return p.videos_started > 0; });
    var started = d.videos.reduce(function (s, v) { return s + (v.people_started || 0); }, 0);
    var fin = d.videos.reduce(function (s, v) { return s + (v.people_finished || 0); }, 0);
    var referred = signed.filter(function (p) { return p.referral_code; }).length;
    $("updated").textContent = "Updated " + new Date().toLocaleString(undefined, { hour: "numeric", minute: "2-digit", month: "short", day: "numeric" }) + " · reload the page to refresh";
    $("stats").innerHTML = [[signed.length + " / " + d.people.length, "signed in / invited"], [week.length, "visited in last 7 days"],
      [watched.length, "watched at least one video"], [started ? Math.round(100 * fin / started) + "%" : "—", "video completion rate"],
      [referred, "came via a ministry link"]]
      .map(function (s) { return '<div class="stat"><b>' + esc(s[0]) + "</b><span>" + esc(s[1]) + "</span></div>"; }).join("");
    table($("tPeople"), d.people, COLS.people, "No one yet — add testers under “Invite testers”.");
    table($("tVideos"), d.videos, COLS.videos, "No video plays yet.");
    table($("tRefs"), d.referrers, COLS.referrers, "No ministries yet — add one below.");
    table($("tWatch"), d.watch, COLS.watch, "No video plays yet.");
    table($("tRecent"), d.recent, COLS.recent, "No activity yet.");
    paintInvites(d.invites);
    [].forEach.call(document.querySelectorAll("[data-copy]"), function (b) {
      b.addEventListener("click", function () {
        var t = b.getAttribute("data-copy");
        var done = function () { b.textContent = "Copied ✓"; setTimeout(function () { b.textContent = "Copy link"; }, 1500); };
        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).then(done, function () { prompt("Copy this link:", t); });
        else prompt("Copy this link:", t);
      });
    });
  }
  [].forEach.call(document.querySelectorAll("[data-csv]"), function (b) {
    b.addEventListener("click", function () {
      var k = b.getAttribute("data-csv"); if (!DATA) return;
      var cols = COLS[k].filter(function (c) { return c[0] !== "link"; });
      if (k === "referrers") cols = cols.concat([["link", "Link"]]);
      download("ad30-" + k + "-" + new Date().toISOString().slice(0, 10) + ".csv", toCSV(DATA[k] || [], cols));
    });
  });

  function paintInvites(list) {
    table($("tInvites"), list, [["email", "Email"], ["invited_at", "Added", fWhen],
      ["email", "", function (v) { return '<button class="xbtn" type="button" data-rm="' + esc(v) + '">Remove</button>'; }]], "The list is empty.");
    [].forEach.call($("tInvites").querySelectorAll("[data-rm]"), function (b) {
      b.addEventListener("click", function () {
        var em = b.getAttribute("data-rm");
        if (!confirm("Remove " + em + " from the list? (If they already signed in, also delete them under Supabase > Authentication > Users.)")) return;
        if (AD30.demo) { b.closest("tr").remove(); return; }
        AD30.sb.from("invites").delete().eq("email", em).then(function (r) { if (r.error) alert(r.error.message); else refresh(); });
      });
    });
  }
  function refresh() { load().then(paint).catch(showErr); }
  function showErr(e) { $("notAdmin").hidden = false; $("notAdmin").textContent = "Couldn’t load: " + (e.message || e); }
  function say(el, t, kind) { el.textContent = t; el.className = "msg " + (kind || ""); }

  $("inviteForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var m = $("inviteMsg"), emails = $("inviteEmails").value.split(/[\s,;]+/).map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
    var bad = emails.filter(function (s) { return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); });
    if (!emails.length) return say(m, "Type at least one email.", "err");
    if (bad.length) return say(m, "These don’t look like emails: " + bad.join(", "), "err");
    if (AD30.demo) return say(m, "Demo: would add " + emails.join(", "), "ok");
    AD30.sb.from("invites").upsert(emails.map(function (x) { return { email: x }; }), { onConflict: "email", ignoreDuplicates: true }).then(function (r) {
      if (r.error) return say(m, r.error.message, "err");
      say(m, "Added " + emails.length + ". Now send them the link: " + siteUrl(), "ok"); $("inviteEmails").value = ""; refresh();
    });
  });

  $("refForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var m = $("refMsg"), code = $("rCode").value.trim().toUpperCase().replace(/\s+/g, "");
    if (!/^[A-Z0-9_-]{2,40}$/.test(code)) return say(m, "Code: 2–40 letters/numbers (no spaces), e.g. GRACECHAPEL.", "err");
    var row = { code: code, ministry_name: $("rName").value.trim(), contact_name: $("rContact").value.trim() || null,
                contact_email: $("rEmail").value.trim() || null, commission_note: $("rNote").value.trim() || null };
    if (!row.ministry_name) return say(m, "Please enter the ministry name.", "err");
    var link = siteUrl() + "?ref=" + code;
    if (AD30.demo) return say(m, "Demo: would add " + code + ". Their link: " + link, "ok");
    AD30.sb.from("referrers").insert(row).then(function (r) {
      if (r.error) return say(m, /duplicate|unique/i.test(r.error.message) ? "That code is already used." : r.error.message, "err");
      say(m, "Added. Send them this link: " + link, "ok"); $("refForm").reset(); refresh();
    });
  });

  $("accessForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var m = $("accessMsg"), em = $("aEmail").value.trim().toLowerCase(), days = parseInt($("aDays").value, 10);
    if (!em || !(days > 0)) return say(m, "Enter an email and a number of days.", "err");
    var until = new Date(Date.now() + days * 86400e3);
    if (AD30.demo) return say(m, "Demo: would give " + em + " access until " + until.toLocaleDateString(), "ok");
    AD30.sb.rpc("admin_set_access", { p_email: em, p_until: until.toISOString() }).then(function (r) {
      if (r.error) return say(m, r.error.message, "err");
      if (r.data !== true) return say(m, "No member with that email has signed in yet.", "err");
      say(m, em + " now has access until " + until.toLocaleDateString() + ".", "ok"); refresh();
    });
  });

  function sheetCheck() {
    AD30.loadVideos().then(function (s) {
      if (s.error === "no-sheet") { $("tSheet").innerHTML = '<p class="hint" style="padding:12px 14px;margin:0">No sheet link in js/config.js yet.</p>'; return; }
      var rows = s.rows.map(function (r) {
        return { row: r.row, title: r.title, marker: r.marker || "(own card)", ref: r.ref, published: r.published ? "yes" : "no",
          video: r.kind === "youtube" ? "YouTube ✓" : r.kind === "mp4" ? "MP4 file" : "—",
          on_site: r.onSite ? "showing" : "hidden", notified: r.notified, issues: r.issues.join("; "),
          _cls: r.issues.filter(function (i) { return i.indexOf("note:") !== 0; }).length ? "warn" : "" };
      });
      table($("tSheet"), rows, [["row", "Row", null, "num"], ["title", "Title"], ["marker", "Card"], ["ref", "Verse"], ["published", "Published"],
        ["video", "Link"], ["on_site", "On site"], ["notified", "Emailed"], ["issues", "Check"]], "The sheet has no video rows yet.");
      if (s.error) $("tSheet").insertAdjacentHTML("afterbegin", '<p class="hint warn" style="padding:10px 14px;margin:0">Couldn’t read the sheet: ' +
        esc(s.error) + (s.fromCache ? " (showing the last saved copy)" : "") + "</p>");
    });
  }

  AD30.startAuth({
    onIn: function (user) {
      $("page").hidden = false; $("whoami").textContent = user.email || "";
      $("signOut").addEventListener("click", AD30.signOut);
      var inConfig = AD30.isAdminEmail(user.email);
      var check = AD30.demo ? Promise.resolve(true) : AD30.sb.rpc("am_i_admin").then(function (r) { return r.data === true; });
      check.then(function (dbAdmin) {
        if (!dbAdmin) {
          $("notAdmin").hidden = false;
          $("notAdmin").textContent = inConfig
            ? "Your email is in js/config.js (ADMIN_EMAILS) but not yet in the database’s admins list. Run the “admins” lines at the bottom of supabase/schema.sql with your email (SETUP.md step 4)."
            : "You’re signed in, but this email isn’t on the admin list.";
          return;
        }
        if (!inConfig && !AD30.demo && window.console) console.warn("Admin in database but not in AD30_CONFIG.ADMIN_EMAILS - add it so the site shows the admin link.");
        $("adminBody").hidden = false;
        try { if (window.AD30LA) window.AD30LA.start(user); } catch (e) { if (window.console) console.warn("[lessons]", e); }
        try { if (window.AD30RA) window.AD30RA.start(user); } catch (e) { if (window.console) console.warn("[resources]", e); }   // [drive-resources]
        refresh(); sheetCheck();
      });
    },
    onOut: function () { $("page").hidden = true; }
  });
})();
