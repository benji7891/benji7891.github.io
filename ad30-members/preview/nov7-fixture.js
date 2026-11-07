/* PREVIEW FIXTURE — Nov 7, 2026 member additions.
   Loaded only by preview/nov7-additions.html, which does not load production js/config.js.
   Demo mode (the site's own flag) only runs while the site is not connected, so this file
   cannot sign in or write to the live database. Nothing here is sent anywhere.
   Lessons 11.1–12.2 are stand-ins: real public titles and the owner's confirmed spots,
   so the new lessons can be seen in order. They are not inserts. */
(function () {
  "use strict";
  var STAND = "Fixture stand-in for a lesson already on the live site. Not part of the Nov 7 insert.";
  function lesson(id, title, yt, marker, sort, at, summary) {
    return {
      id: id, title: title, youtube_url: "https://youtu.be/" + yt, youtube_id: yt, video_source: "youtube",
      marker_id: marker, summary: summary || null, verse_refs: null, sort_order: sort, published: true, notified: false,
      created_at: at, updated_at: at, created_by: "fixture@preview.local",
      timeline_year: null, timeline_month: null, timeline_day: null, timeline_label: null, fixture: true
    };
  }
  function guide(id, title, driveId, marker, sort, at) {
    return {
      id: id, title: title, note: null, kind: "link", storage_path: null, thumb_path: null,
      url: "https://drive.google.com/file/d/" + driveId + "/view", mime: null, size_bytes: null,
      marker_id: marker, sort_order: sort, published: true, created_at: at, created_by: "fixture@preview.local",
      timeline_year: null, timeline_month: null, timeline_day: null, timeline_label: null, fixture: true, drive_id: driveId
    };
  }
  var LESSONS = [
    lesson("fix-11-1", "Red Letter 11.1: Not Unto Death", "pfJTMPaLD-c", "jn1155", 10, "2026-10-20T02:00:00.000Z", STAND),
    lesson("fix-11-2", "Red Letter 11.2: The Resurrection and the Life", "Kvp2b-VN9QE", "jn1155", 20, "2026-10-20T02:05:00.000Z", STAND),
    lesson("fix-11-3", "Red Letter 11.3: Jesus Wept", "MWhTrJgDArA", "jn1155", 30, "2026-10-20T02:10:00.000Z", STAND),
    lesson("fix-11-4", "Red Letter 11.4: Take Ye Away the Stone", "OirVfIQTZgc", "jn1155", 40, "2026-10-20T02:15:00.000Z", STAND),
    lesson("fix-11-5", "Red Letter 11.5: It Is Expedient", "w3TQfxJlrp0", "jn1155", 50, "2026-10-20T02:20:00.000Z", STAND),
    lesson("fix-12-1", "Red Letter 12.1: Six Days Before the Passover", "MpstCh-81kQ", "jn121", 10, "2026-10-28T02:00:00.000Z", STAND),
    lesson("fix-12-2", "Red Letter 12.2: Behold, Thy King Cometh", "Spnq98mXzDg", "entry", 10, "2026-10-30T02:00:00.000Z", STAND),
    lesson("fix-12-3", "Red Letter 12.3: The Hour Is Come", "W0Jiusiejwg", "jn12b", 10, "2026-11-06T12:44:00.000Z", null),
    lesson("fix-12-4", "Red Letter 12.4: He Hath Blinded Their Eyes", "nRCD4of7ewg", "jn12b", 20, "2026-11-06T12:49:00.000Z", null),
    lesson("fix-12-5", "Red Letter 12.5: The Last Day", "ifNlS1u3Ldw", "jn12b", 30, "2026-11-06T12:53:00.000Z", null),
    lesson("fix-hb", "The Heartbeat of the King: From Adam to the Throne", "Wq00ueSP9qY", "heartbeat", 10, "2026-11-06T12:59:00.000Z", null)
  ];
  var HB = "The Heartbeat of the King: From Adam to the Throne";
  var RESOURCES = [
    guide("fix-g-12-3", "Red Letter 12.3: The Hour Is Come", "1TpXPGgHb11L1oGwsPo7NKh7X1XlBgOpi", "jn12b", 10, "2026-11-06T12:44:30.000Z"),
    guide("fix-g-12-4", "Red Letter 12.4: He Hath Blinded Their Eyes", "1dANdRqlZBBo_KJSs3wZvDX7FDbouvukJ", "jn12b", 20, "2026-11-06T12:49:30.000Z"),
    guide("fix-g-12-5", "Red Letter 12.5: The Last Day", "1sWtzLVSlCp5S8itgna5XZ4dYvObbAzcW", "jn12b", 30, "2026-11-06T12:53:30.000Z"),
    guide("fix-g-hb-1", HB + " — Study Notes", "1GC5H5mryhyc_m2me76Eds-k_kYe66LGC", "heartbeat", 1, "2026-11-06T12:59:10.000Z"),
    guide("fix-g-hb-2", HB + " — Six Week Study Series", "14T864o1SHLzfQyH8N2Bm-U9KQ0U8AjBK", "heartbeat", 2, "2026-11-06T12:59:20.000Z"),
    guide("fix-g-hb-3", HB + " — Six Week Deeper Teaching", "1Cuxqq4MNal_7OJ5sQVmfY6u35dm3cLAK", "heartbeat", 3, "2026-11-06T12:59:30.000Z"),
    guide("fix-g-hb-4", HB + " — Companion Handout", "1JJ4JvFK17Fb3qgxoa8VS_fznwFTerA1W", "heartbeat", 4, "2026-11-06T12:59:40.000Z")
  ];
  try { localStorage.setItem("ad30m.demoLessons", JSON.stringify(LESSONS)); } catch (e) {}
  if (!window.AD30R || typeof window.AD30R.fetch !== "function") return;
  window.AD30R.fetch = function () {
    return Promise.resolve({ rows: RESOURCES.map(function (r) { return Object.assign({}, r); }) });
  };
  window.__NOV7_FIXTURE = { label: "PREVIEW FIXTURE", lessons: LESSONS, resources: RESOURCES };
})();
