/* AD30 members - private chat between each member and the Admins (Ben, Sam).           [chat, new file]
   Member page (simple.html): a "Chat with the admins" button opens the member's own thread.
   Admin page (admin.html): "Member chats" inbox (newest first, unread markers) -> open a thread -> reply.
   Data: public.chat_threads / public.chat_messages (migrations/2026-10-17_chat.sql). The database's
   row-level security decides who sees what; this file only draws the screens.
   Live updates: Supabase Realtime (new rows in chat_messages). If that isn't connected, it checks every 15 s.
   SAFETY: every message is put on the page with textContent (never innerHTML), so typed text can't run as code.
   PREVIEW: in demo mode (site not connected, ?demo=1) it uses made-up EXAMPLE DATA and saves nothing.
   [admin-chat] Admin page also has a pinned "Ben & Sam (admins only)" chat: table public.admin_chat_messages
   (migrations/2026-10-17_admin_chat.sql). Only Admins can read or write it; it is separate from member chats. */
(function () {
  "use strict";
  var AD30 = window.AD30;
  if (!AD30) return;
  var $ = AD30.$, MAX = 2000, POLL_MS = 15000;
  var ADMIN_NAMES = { "benjiferguson@gmail.com": "Ben", "shughes@jstrongindustries.com": "Sam" };
  var CH = (window.AD30CHAT = {});

  /* ---------------- small helpers ---------------- */
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = String(text);   // text only: never parsed as HTML
    return e;
  }
  var fmtTime, fmtDay;
  try {
    fmtTime = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });
    fmtDay = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric" });
  } catch (e) { fmtTime = fmtDay = null; }
  function dayKey(d) { return fmtDay ? fmtDay.format(d) : d.toDateString(); }
  function dayLabel(d) {
    var k = dayKey(d);
    return k === dayKey(new Date()) ? "Today" : k === dayKey(new Date(Date.now() - 864e5)) ? "Yesterday" : k;
  }
  function when(iso, short) {
    var d = new Date(iso); if (isNaN(d)) return "";
    var t = fmtTime ? fmtTime.format(d) : d.toLocaleTimeString();
    var isToday = dayKey(d) === dayKey(new Date()), day = dayLabel(d);
    if (short) return (isToday ? t : day) + " ET";
    return day + ", " + t + " ET";
  }
  function senderLabel(m, viewerIsAdmin) {
    if (m.sender_is_admin) return (m.sender_name || "Admin") + " · Admin";
    return viewerIsAdmin ? (m.sender_name || "Member") : "You";
  }
  function friendly(err) {
    var s = String((err && (err.message || err.details)) || err || "");
    if (/SLOW_DOWN/.test(s)) return "You’ve sent a lot of messages just now. Please wait a few minutes.";
    if (/no access/i.test(s)) return "Your free access has ended, so chat is closed for now.";
    if (/fetch|network|load failed/i.test(s)) return "Couldn’t reach the site. Check your connection and try again.";
    return "Couldn’t send. Please try again.";
  }

  /* ---------------- data layer: real (Supabase) or EXAMPLE DATA (demo) ---------------- */
  var api = AD30.demo ? mockApi() : realApi();

  function realApi() {
    var sb = AD30.sb;
    return {
      myThread: function () { return sb.rpc("chat_my_thread").then(function (r) { if (r.error) throw r.error; return r.data; }); },
      thread: function (id) {
        return sb.from("chat_threads").select("*").eq("id", id).maybeSingle().then(function (r) { if (r.error) throw r.error; return r.data; });
      },
      threads: function () {
        return sb.from("chat_threads").select("*").not("last_message_at", "is", null)
          .order("last_message_at", { ascending: false }).limit(200)
          .then(function (r) { if (r.error) throw r.error; return r.data || []; });
      },
      messages: function (tid) {
        return sb.from("chat_messages").select("id,thread_id,sender_name,sender_is_admin,body,created_at")
          .eq("thread_id", tid).order("created_at", { ascending: true }).limit(500)
          .then(function (r) { if (r.error) throw r.error; return r.data || []; });
      },
      send: function (tid, body) {
        return sb.from("chat_messages").insert({ thread_id: tid, body: body })
          .select("id,thread_id,sender_name,sender_is_admin,body,created_at").single()
          .then(function (r) { if (r.error) throw r.error; return r.data; });
      },
      markRead: function (tid) { return sb.rpc("chat_mark_read", { p_thread: tid }).then(function () {}, function () {}); },
      // onRow(message) for each new message the viewer is allowed to see; onState(true/false) = live or not
      live: function (name, filter, onRow, onState, table) {
        if (!sb.channel) { onState(false); return; }
        var opts = { event: "INSERT", schema: "public", table: table || "chat_messages" };
        if (filter) opts.filter = filter;
        var timer = setTimeout(function () { onState(false); }, 10000);
        try {
          sb.channel(name).on("postgres_changes", opts, function (p) { if (p && p.new) onRow(p.new); })
            .subscribe(function (status) {
              if (status === "SUBSCRIBED") { clearTimeout(timer); onState(true); }
              else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") { clearTimeout(timer); onState(false); }
            });
        } catch (e) { clearTimeout(timer); onState(false); }
      },
      // [admin-chat] Ben & Sam admin-only chat (one shared room)
      admin: {
        messages: function () {
          return sb.from("admin_chat_messages").select("id,sender_id,sender_name,body,created_at")
            .order("created_at", { ascending: true }).limit(500)
            .then(function (r) { if (r.error) throw r.error; return r.data || []; });
        },
        last: function () {
          return sb.from("admin_chat_messages").select("id,sender_id,sender_name,body,created_at")
            .order("id", { ascending: false }).limit(1)
            .then(function (r) { if (r.error) throw r.error; return (r.data || [])[0] || null; });
        },
        send: function (body) {
          return sb.from("admin_chat_messages").insert({ body: body })
            .select("id,sender_id,sender_name,body,created_at").single()
            .then(function (r) { if (r.error) throw r.error; return r.data; });
        },
        unread: function () { return sb.rpc("admin_chat_unread").then(function (r) { return r.error ? 0 : (r.data || 0); }, function () { return 0; }); },
        markRead: function () { return sb.rpc("admin_chat_mark_read").then(function () {}, function () {}); }
      }
    };
  }

  function mockApi() {
    // EXAMPLE DATA ONLY - made-up members and messages for the preview screenshots. Nothing is saved.
    var now = Date.now(), H = 3600e3, M = 60e3, id = 100;
    function ago(ms) { return new Date(now - ms).toISOString(); }
    var T = [
      { id: "t1", member_email: "sarah.example@example.com", admin_unread: 2, member_unread: 0 },
      { id: "t2", member_email: "james.example@example.com", admin_unread: 0, member_unread: 1 },
      { id: "t3", member_email: "ruth.example@example.com", admin_unread: 1, member_unread: 0 },
      { id: "t4", member_email: "mark.example@example.com", admin_unread: 0, member_unread: 0 }
    ];
    var Ms = [
      ["t1", false, "sarah.example@example.com", "Hi Ben and Sam! I watched Red Letter 7.1B tonight. Is The Light lesson on the 8th day of the feast?", 3 * H],
      ["t1", true, "Sam", "Yes, that’s right. John 8:12 is the day after the last great day. We’re moving it to its own spot this weekend.", 2.6 * H],
      ["t1", false, "sarah.example@example.com", "Thank you! Where should I start with Daniel 12?", 12 * M],
      ["t1", false, "sarah.example@example.com", "Also, could you pray for my mom? She has surgery Monday.", 9 * M],
      ["t2", false, "james.example@example.com", "Can I print the study notes for my Sunday class?", 26 * H],
      ["t2", true, "Ben", "Absolutely. Open Study notes and tap Print, or use “Print all notes”.", 25 * H],
      ["t3", false, "ruth.example@example.com", "The 30th year video stopped halfway for me on my iPad.", 50 * M],
      ["t4", false, "mark.example@example.com", "Thanks for putting this together. It’s been a blessing.", 4 * 24 * H],
      ["t4", true, "Ben", "Thank you, Mark. Glad you’re walking through it with us.", 4 * 24 * H - 30 * M]
    ].map(function (a) { return { id: ++id, thread_id: a[0], sender_is_admin: a[1], sender_name: a[2], body: a[3], created_at: ago(a[4]) }; });
    function sync() {
      T.forEach(function (t) {
        var last = Ms.filter(function (m) { return m.thread_id === t.id; }).pop();
        if (last) { t.last_message_at = last.created_at; t.last_preview = last.body.slice(0, 140); t.last_from_admin = last.sender_is_admin; }
      });
    }
    sync();
    function P(v) { return new Promise(function (res) { setTimeout(function () { res(JSON.parse(JSON.stringify(v))); }, 60); }); }
    function find(tid) { return T.filter(function (x) { return x.id === tid; })[0]; }
    return {
      example: true,
      myThread: function () { return P("t1"); },
      thread: function (tid) { return P(find(tid) || null); },
      threads: function () { sync(); return P(T.slice().sort(function (a, b) { return a.last_message_at < b.last_message_at ? 1 : -1; })); },
      messages: function (tid) { return P(Ms.filter(function (m) { return m.thread_id === tid; })); },
      send: function (tid, body) {
        var isAdmin = CH.viewerIsAdmin;
        var m = { id: ++id, thread_id: tid, sender_is_admin: isAdmin, sender_name: isAdmin ? "Ben" : "sarah.example@example.com",
                  body: body, created_at: new Date().toISOString() };
        Ms.push(m); sync();
        var t = find(tid);
        if (t) { if (isAdmin) { t.member_unread++; t.admin_unread = 0; } else t.admin_unread++; }
        return P(m);
      },
      markRead: function (tid) {
        var t = find(tid);
        if (t) { if (CH.viewerIsAdmin) t.admin_unread = 0; else t.member_unread = 0; }
        return P(null);
      },
      live: function (n, f, onRow, onState) { setTimeout(function () { onState(true); }, 50); },
      // [admin-chat] EXAMPLE DATA: the demo viewer is "Ben" (user id "demo"); Sam is "sam-example"
      admin: (function () {
        var A = [
          ["sam-example", "Sam", "Ben, can you look at where 7.1B sits on the timeline before we meet?", 5 * H],
          ["demo", "Ben", "Yes. I’ll check it tonight. Coffee at 10 tomorrow?", 4.5 * H],
          ["sam-example", "Sam", "Works for me. Sarah asked about Daniel 12 in her chat, can you answer her?", 20 * M],
          ["sam-example", "Sam", "Also, Ruth says the 30th year video stops halfway on her iPad.", 15 * M]
        ].map(function (a) { return { id: ++id, sender_id: a[0], sender_name: a[1], body: a[2], created_at: ago(a[3]) }; });
        var readUpTo = A[1].id;
        return {
          messages: function () { return P(A); },
          last: function () { return P(A[A.length - 1] || null); },
          send: function (body) { var m = { id: ++id, sender_id: "demo", sender_name: "Ben", body: body, created_at: new Date().toISOString() }; A.push(m); readUpTo = m.id; return P(m); },
          unread: function () { return P(A.filter(function (m) { return m.id > readUpTo && m.sender_id !== "demo"; }).length); },
          markRead: function () { if (A.length) readUpTo = A[A.length - 1].id; return P(null); }
        };
      })()
    };
  }

  /* ---------------- shared: one conversation view ---------------- */
  // Builds the message list + reply box inside `box`. Returns { load(tid), add(row), refresh(), focus() }.
  function Conversation(box, opts) {
    var list = el("ol", "ch-msgs"), seen = {}, lastDay = "", c = { tid: null }, src = opts.src || api;
    list.setAttribute("aria-live", "polite");
    var form = el("form", "ch-form"), ta = el("textarea", "field ch-input"), btn = el("button", "btn ch-send", "Send");
    var count = el("p", "ch-count"), err = el("p", "msg err ch-err");
    ta.rows = 2; ta.maxLength = MAX; ta.placeholder = opts.placeholder || "Type a message…";
    ta.setAttribute("aria-label", "Your message"); btn.type = "submit"; err.hidden = true;
    form.setAttribute("novalidate", ""); form.appendChild(ta); form.appendChild(btn);
    var empty = el("p", "ch-empty", opts.emptyText || "No messages yet.");
    box.appendChild(list); box.appendChild(empty); box.appendChild(err); box.appendChild(form); box.appendChild(count);

    function scrollDown() { try { list.scrollTop = list.scrollHeight; } catch (e) {} }
    function add(m) {
      if (!m || m.thread_id !== c.tid || seen[m.id]) return false;
      seen[m.id] = 1; empty.hidden = true;
      var d = new Date(m.created_at), k = dayKey(d);
      if (k !== lastDay) { lastDay = k; list.appendChild(el("li", "ch-day", dayLabel(d))); }
      var mine = opts.isMine ? opts.isMine(m) : (opts.viewerIsAdmin ? m.sender_is_admin : !m.sender_is_admin);
      var li = el("li", "ch-m " + (mine ? "ch-mine" : "ch-theirs") + (m.sender_is_admin ? " ch-admin" : ""));
      var meta = el("p", "ch-meta");
      meta.appendChild(el("b", null, opts.label ? opts.label(m) : senderLabel(m, opts.viewerIsAdmin)));
      meta.appendChild(document.createTextNode(" · " + when(m.created_at)));
      li.appendChild(meta);
      li.appendChild(el("p", "ch-body", m.body));   // textContent: safe
      list.appendChild(li);
      return true;
    }
    c.add = function (m) { if (add(m)) { scrollDown(); return true; } return false; };
    c.load = function (tid) {
      c.tid = tid; seen = {}; lastDay = ""; list.textContent = ""; empty.hidden = false;
      return src.messages(tid).then(function (rows) { rows.forEach(add); scrollDown(); });
    };
    c.refresh = function () {
      if (!c.tid) return Promise.resolve(0);
      return src.messages(c.tid).then(function (rows) { var n = 0; rows.forEach(function (m) { if (add(m)) n++; }); if (n) scrollDown(); return n; });
    };
    function counter() { var n = ta.value.length; count.textContent = n > MAX - 200 ? (MAX - n) + " characters left" : ""; }
    ta.addEventListener("input", counter);
    ta.addEventListener("keydown", function (e) {   // desktop: Enter sends, Shift+Enter = new line. Phones: tap Send.
      if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) { e.preventDefault(); if (form.requestSubmit) form.requestSubmit(); else btn.click(); }
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var body = ta.value.replace(/^\s+|\s+$/g, "");
      if (!body || !c.tid) return;
      if (body.length > MAX) { err.hidden = false; err.textContent = "Please keep it under " + MAX + " characters."; return; }
      btn.disabled = true; btn.textContent = "Sending…"; err.hidden = true;
      src.send(c.tid, body).then(function (row) {
        btn.disabled = false; btn.textContent = "Send"; ta.value = ""; counter(); c.add(row);
        if (opts.onSent) opts.onSent(row);
      }, function (er) { btn.disabled = false; btn.textContent = "Send"; err.hidden = false; err.textContent = friendly(er); });
    });
    c.focus = function () { try { ta.focus(); } catch (e) {} };
    return c;
  }

  function exampleBanner() {
    return el("p", "ch-example", "EXAMPLE DATA · preview only · made-up names and messages · nothing is saved or sent");
  }

  /* ---------------- MEMBER: simple.html ---------------- */
  function startMember() {
    var fab = el("button", "ch-fab"), badge = el("span", "ch-badge");
    fab.type = "button"; fab.setAttribute("aria-haspopup", "dialog");
    fab.appendChild(el("span", "ch-fab-ic", "💬")); fab.appendChild(el("span", null, "Chat with the admins")); fab.appendChild(badge);
    badge.hidden = true;
    var panel = el("div", "ch-panel"); panel.hidden = true;
    panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "true"); panel.setAttribute("aria-label", "Chat with the admins");
    var bar = el("div", "ch-bar"), close = el("button", "ch-x", "‹ Back");
    close.type = "button";
    var ttl = el("div", "ch-title"); ttl.appendChild(el("b", "serif", "Chat with the admins")); ttl.appendChild(el("span", null, "Ben and Sam · private"));
    bar.appendChild(close); bar.appendChild(ttl);
    panel.appendChild(bar);
    if (api.example) panel.appendChild(exampleBanner());
    panel.appendChild(el("p", "ch-note", "Only you and the Admins (Ben and Sam) can see this chat. Other members can’t."));
    var state = el("p", "ch-state"); panel.appendChild(state);
    var body = el("div", "ch-conv"); panel.appendChild(body);
    document.body.appendChild(fab); document.body.appendChild(panel);

    var conv = Conversation(body, { viewerIsAdmin: false, placeholder: "Ask a question or share a prayer need…",
      emptyText: "Say hello! Ben or Sam will answer here, usually within a day." });
    var tid = null, pollT = null;
    function setBadge(n) { badge.hidden = !n; badge.textContent = n > 9 ? "9+" : String(n || ""); fab.classList.toggle("ch-has-new", !!n); }
    function isOpen() { return !panel.hidden && !document.hidden; }
    function checkUnread() {
      if (!tid) return;
      if (isOpen()) { conv.refresh().then(function () { api.markRead(tid); }); setBadge(0); return; }
      api.thread(tid).then(function (t) { setBadge(t ? t.member_unread : 0); }, function () {});
    }
    function setLive(on) {
      state.textContent = on ? "" : "Checking for new messages every 15 seconds.";
      clearInterval(pollT); if (!on) pollT = setInterval(checkUnread, POLL_MS);
    }
    function ensure() {
      if (tid) return Promise.resolve(tid);
      return api.myThread().then(function (id) {
        tid = id;
        api.live("chat-member-" + id, "thread_id=eq." + id, function (row) {
          if (row.thread_id !== tid) return;
          if (isOpen()) { conv.add(row); api.markRead(tid); } else if (row.sender_is_admin) checkUnread();
        }, setLive);
        return conv.load(id);
      });
    }
    function open() {
      panel.hidden = false; fab.hidden = true; document.documentElement.classList.add("ch-open");
      if (!api.example) { try { history.pushState({ ch: 1 }, "", "#chat"); } catch (e) {} }
      ensure().then(function () { setBadge(0); api.markRead(tid); conv.focus(); },
        function (e) { state.textContent = friendly(e).replace("Couldn’t send.", "Couldn’t open the chat."); });
    }
    function shut() { panel.hidden = true; fab.hidden = false; document.documentElement.classList.remove("ch-open"); }
    fab.addEventListener("click", open);
    close.addEventListener("click", function () { if (location.hash === "#chat") history.back(); else shut(); });
    window.addEventListener("popstate", function () { if (!panel.hidden && location.hash !== "#chat") shut(); });
    document.addEventListener("visibilitychange", function () { if (!document.hidden) checkUnread(); });
    // Find the thread quietly at start so the unread badge shows (makes the thread on first visit; no message sent).
    ensure().then(checkUnread, function () {});
    if (location.hash === "#chat") open();
    CH.member = { open: open, close: shut };
  }

  /* ---------------- ADMIN: admin.html ---------------- */
  function startAdmin(user) {
    var host = $("adminBody"); if (!host) return;
    var sec = el("section", "lx-admin ch-admin"); sec.id = "chatAdmin";
    var h = el("h2", "serif", "Member chats"); h.id = "chatH"; sec.setAttribute("aria-labelledby", "chatH");
    sec.appendChild(h);
    if (api.example) sec.appendChild(exampleBanner());
    var tip = el("p", "lx-tip", "Private one-on-one chats. Each member sees only their own chat with you. Ben and Sam both see every chat and can reply.");
    sec.appendChild(tip);
    var state = el("p", "ch-state"); sec.appendChild(state);
    // [admin-chat] pinned "Ben & Sam (admins only)" row, kept apart from the member list
    var pinList = el("ul", "ch-inbox ch-pins"), pinLi = el("li"), pin = el("button", "ch-row ch-row-pin");
    pin.type = "button";
    var pinTop = el("span", "ch-row-top"), pinWho = el("span", "ch-who", "🔒 Ben & Sam (admins only)"), pinWhen = el("span", "ch-when", "");
    var pinBot = el("span", "ch-row-bot"), pinPrev = el("span", "ch-prev", "Private chat between the two Admins"), pinBadge = el("span", "ch-badge");
    pinBadge.hidden = true;
    pinTop.appendChild(pinWho); pinTop.appendChild(pinWhen); pinBot.appendChild(pinPrev); pinBot.appendChild(pinBadge);
    pin.appendChild(pinTop); pin.appendChild(pinBot); pinLi.appendChild(pin); pinList.appendChild(pinLi); sec.appendChild(pinList);
    var inbox = el("ul", "ch-inbox"); sec.appendChild(inbox);
    var emptyIn = el("p", "hint", "No member messages yet."); emptyIn.hidden = true; sec.appendChild(emptyIn);
    var view = el("div", "ch-thread"); view.hidden = true;
    var vbar = el("div", "ch-bar ch-bar-in"), back = el("button", "ch-x", "‹ All chats"); back.type = "button";
    var vt = el("div", "ch-title"), vName = el("b", null, ""), vSub = el("span", null, "Private · only this member and the Admins");
    vt.appendChild(vName); vt.appendChild(vSub); vbar.appendChild(back); vbar.appendChild(vt); view.appendChild(vbar);
    var vbody = el("div", "ch-conv"); view.appendChild(vbody); sec.appendChild(view);
    // [admin-chat] the Ben & Sam view
    var aview = el("div", "ch-thread ch-thread-admins"); aview.hidden = true;
    var abar = el("div", "ch-bar ch-bar-in"), aback = el("button", "ch-x", "‹ All chats"); aback.type = "button";
    var at = el("div", "ch-title"); at.appendChild(el("b", null, "🔒 Ben & Sam"));
    at.appendChild(el("span", null, "Admins only · members can’t see this"));
    abar.appendChild(aback); abar.appendChild(at); aview.appendChild(abar);
    var abody = el("div", "ch-conv"); aview.appendChild(abody); sec.appendChild(aview);
    host.insertBefore(sec, host.firstChild);

    var myName = api.example ? "Ben" : (ADMIN_NAMES[String(user.email || "").toLowerCase()] || "Admin");
    var conv = Conversation(vbody, { viewerIsAdmin: true, placeholder: "Reply as " + myName + "…",
      emptyText: "No messages in this chat yet.", onSent: function () { loadInbox(); } });
    var openTid = null, pollT = null, threadsById = {};
    // [admin-chat] Ben & Sam conversation. Rows get thread_id "admins" so the shared view code can use them.
    var myId = AD30.user && AD30.user.id, otherName = myName === "Ben" ? "Sam" : myName === "Sam" ? "Ben" : "the other Admin";
    function tag(m) { if (m) m.thread_id = "admins"; return m; }
    var asrc = {
      messages: function () { return api.admin.messages().then(function (rows) { return rows.map(tag); }); },
      send: function (tid, body) { return api.admin.send(body).then(tag); }
    };
    var aconv = Conversation(abody, { src: asrc, placeholder: "Message " + otherName + "…",
      emptyText: "No messages yet. Only Ben and Sam can see this chat.",
      isMine: function (m) { return !!myId && m.sender_id === myId; },
      label: function (m) { return m.sender_name || "Admin"; },
      onSent: function () { api.admin.markRead().then(drawPin); } });
    var aOpen = false, apollT = null;
    function drawPin() {
      return Promise.all([api.admin.last(), api.admin.unread()]).then(function (r) {
        var last = r[0], n = r[1] || 0;
        pinWhen.textContent = last ? when(last.created_at, true) : "";
        pinPrev.textContent = last ? (last.sender_name || "Admin") + ": " + String(last.body).replace(/\s+/g, " ").slice(0, 140) : "Private chat between the two Admins";
        pinBadge.hidden = !n; pinBadge.textContent = n > 9 ? "9+" : String(n);
        pin.classList.toggle("ch-unread", !!n);
      }, function () {});
    }
    function openAdmins() {
      aOpen = true; openTid = null;
      pinList.hidden = true; inbox.hidden = true; emptyIn.hidden = true; tip.hidden = true; view.hidden = true; aview.hidden = false;
      aconv.load("admins").then(function () { api.admin.markRead().then(drawPin); });
      try { sec.scrollIntoView({ block: "start" }); } catch (e) {}
    }
    function closeAdmins() { aOpen = false; aview.hidden = true; pinList.hidden = false; inbox.hidden = false; tip.hidden = false; drawPin(); loadInbox(); }
    pin.addEventListener("click", openAdmins);
    aback.addEventListener("click", closeAdmins);
    function atick() { if (aOpen && !document.hidden) aconv.refresh().then(function (n) { if (n) api.admin.markRead().then(drawPin); }); else drawPin(); }
    api.live("chat-admins-only", null, function (row) {
      tag(row);
      if (aOpen && !document.hidden) { aconv.add(row); api.admin.markRead().then(drawPin); } else drawPin();
    }, function (on) { clearInterval(apollT); if (!on) apollT = setInterval(atick, POLL_MS); }, "admin_chat_messages");
    drawPin();

    function drawInbox(rows) {
      inbox.textContent = ""; threadsById = {};
      emptyIn.hidden = rows.length > 0 || !view.hidden || aOpen;
      var unreadTotal = 0;
      rows.forEach(function (t) {
        threadsById[t.id] = t; unreadTotal += t.admin_unread || 0;
        var li = el("li"), b = el("button", "ch-row" + (t.admin_unread ? " ch-unread" : ""));
        b.type = "button";
        var top = el("span", "ch-row-top");
        top.appendChild(el("span", "ch-who", t.member_email || "Member"));
        top.appendChild(el("span", "ch-when", when(t.last_message_at, true)));
        var bot = el("span", "ch-row-bot");
        bot.appendChild(el("span", "ch-prev", (t.last_from_admin ? "Admin: " : "") + (t.last_preview || "")));
        if (t.admin_unread) { var n = el("span", "ch-badge", t.admin_unread > 9 ? "9+" : t.admin_unread); n.setAttribute("aria-label", t.admin_unread + " unread"); bot.appendChild(n); }
        else if (!t.last_from_admin) bot.appendChild(el("span", "ch-tag", "Needs reply"));
        b.appendChild(top); b.appendChild(bot);
        b.addEventListener("click", function () { openThread(t.id); });
        li.appendChild(b); inbox.appendChild(li);
      });
      h.textContent = "Member chats" + (unreadTotal ? " (" + unreadTotal + " new)" : "");
    }
    function loadInbox() { return api.threads().then(drawInbox, function () { state.textContent = "Couldn’t load the chats. Please reload the page."; }); }
    function openThread(tid) {
      openTid = tid; var t = threadsById[tid] || {};
      vName.textContent = t.member_email || "Member";
      inbox.hidden = true; pinList.hidden = true; emptyIn.hidden = true; tip.hidden = true; view.hidden = false;
      conv.load(tid).then(function () { api.markRead(tid).then(loadInbox); });
      try { sec.scrollIntoView({ block: "start" }); } catch (e) {}
    }
    function closeThread() { openTid = null; view.hidden = true; inbox.hidden = false; pinList.hidden = false; tip.hidden = false; loadInbox(); drawPin(); }
    back.addEventListener("click", closeThread);
    function tick() { loadInbox(); if (openTid && !document.hidden) conv.refresh().then(function (n) { if (n) api.markRead(openTid); }); }
    function setLive(on) {
      state.textContent = on ? "● Live" : "Checking for new messages every 15 seconds.";
      state.className = "ch-state" + (on ? " ch-live" : "");
      clearInterval(pollT); if (!on) pollT = setInterval(tick, POLL_MS);
    }
    api.live("chat-admin", null, function (row) {
      if (openTid && row.thread_id === openTid && !document.hidden) { conv.add(row); api.markRead(openTid).then(loadInbox); }
      else loadInbox();
    }, setLive);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) { tick(); atick(); } });
    if (location.hash === "#chat") setTimeout(function () { try { sec.scrollIntoView({ block: "start" }); } catch (e) {} }, 300);
    loadInbox();
    CH.admin = { open: openThread, back: closeThread, openAdmins: openAdmins, closeAdmins: closeAdmins };
  }

  /* ---------------- start: wait for the page's own sign-in, then attach ---------------- */
  // No changes to simple.js/admin.js needed: we wait until they reveal #page (member) or #adminBody (admin).
  var isAdminPage = !!$("adminBody") && /\badmin\b/.test(document.body.className);
  var started = false;
  function tryStart() {
    if (started || !AD30.user || (!AD30.sb && !AD30.demo)) return;
    if (isAdminPage) {
      if ($("adminBody").hidden) return;
      started = true; CH.viewerIsAdmin = true; startAdmin(AD30.user);
    } else {
      if (!$("page") || $("page").hidden) return;
      started = true;
      if (AD30.demo) { CH.viewerIsAdmin = false; startMember(); return; }   // preview: show the member side
      AD30.checkAdmin(AD30.user).then(function (isAdmin) {
        CH.viewerIsAdmin = isAdmin;
        if (isAdmin) {   // Admins answer from the Admin page; give them a shortcut instead of a member chat
          var a = el("a", "ch-fab", "💬 Member chats →"); a.href = "admin.html#chat"; document.body.appendChild(a);
        } else startMember();
      });
    }
  }
  var iv = setInterval(function () { tryStart(); if (started) clearInterval(iv); }, 400);
  try {
    var mo = new MutationObserver(function () { tryStart(); if (started) mo.disconnect(); });
    mo.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["hidden"] });
  } catch (e) {}
})();
