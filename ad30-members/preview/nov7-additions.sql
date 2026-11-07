-- Nov 7, 2026 — GodsTimeclock member additions
-- PREVIEW SQL. Do not apply until the owner approves the placement.
--
-- Running this file as written starts a transaction, inserts only rows that
-- are not already there, then ROLLS BACK. Nothing is kept. To apply later,
-- replace the final ROLLBACK with COMMIT. There is no UPDATE and no DELETE.
-- This file does not send email and does not change YouTube.
--
-- Placement (proposed):
--   Red Letter 12.3, 12.4, 12.5 -> marker jn12b (new undated spot after entry / 12.2)
--   The Heartbeat of the King   -> marker heartbeat (new undated spot after jn12b, before n10)
-- Members only see those spots after ad30-members/js/lessons.js is published.
-- The teacher timeline HTML lives in public.teacher_content and is NOT changed here.
-- On the teacher page, a lesson whose marker is missing from that HTML shows
-- under Latest lessons until that HTML is updated in a separate approved step.
--
-- Drive links are kind 'link', the same value the admin form stores for a
-- drive.google.com/file/d/.../view URL (the path does not end in .pdf).
-- Heartbeat resource titles start with the lesson title so the member page
-- matches all four to that one video, in sort_order. The bold button text is
-- the ending of the title (Study Notes, Six Week Study Series, Six Week Deeper
-- Teaching, Companion Handout). The three Red Letter guides use the lesson
-- title, so each keeps the single "Study notes" button.
--
-- If public.lessons / public.resources do not yet have video_source or the
-- timeline_* columns, drop those columns from the INSERT lists below.
-- created_by is left to the table default. If a NOT NULL constraint rejects
-- the insert, set created_by to an existing admin user id and run again
-- (the NOT EXISTS guards make a second run skip rows already inserted).

begin;

-- Read-only look before any insert. Expected: no rows for the four new videos.
select youtube_id, title, marker_id, published
from public.lessons
where youtube_id in (
  'W0Jiusiejwg', 'nRCD4of7ewg', 'ifNlS1u3Ldw', 'Wq00ueSP9qY',
  'pfJTMPaLD-c', 'Kvp2b-VN9QE', 'MWhTrJgDArA', 'OirVfIQTZgc', 'w3TQfxJlrp0',
  'MpstCh-81kQ', 'Spnq98mXzDg'
)
order by youtube_id;

select id, title, marker_id, url
from public.resources
where url ilike any (array[
  '%1TpXPGgHb11L1oGwsPo7NKh7X1XlBgOpi%',
  '%1dANdRqlZBBo_KJSs3wZvDX7FDbouvukJ%',
  '%1sWtzLVSlCp5S8itgna5XZ4dYvObbAzcW%',
  '%1GC5H5mryhyc_m2me76Eds-k_kYe66LGC%',
  '%14T864o1SHLzfQyH8N2Bm-U9KQ0U8AjBK%',
  '%1Cuxqq4MNal_7OJ5sQVmfY6u35dm3cLAK%',
  '%1JJ4JvFK17Fb3qgxoa8VS_fznwFTerA1W%'
]);

insert into public.lessons (
  title, youtube_url, youtube_id, video_source, marker_id,
  summary, verse_refs, sort_order, published, notified,
  timeline_year, timeline_month, timeline_day, timeline_label
)
select
  v.title, v.youtube_url, v.youtube_id, 'youtube', v.marker_id,
  null, null, v.sort_order, true, false,
  null, null, null, null
from (
  values
    ('Red Letter 12.3: The Hour Is Come'::text, 'https://youtu.be/W0Jiusiejwg'::text, 'W0Jiusiejwg'::text, 'jn12b'::text, 10),
    ('Red Letter 12.4: He Hath Blinded Their Eyes', 'https://youtu.be/nRCD4of7ewg', 'nRCD4of7ewg', 'jn12b', 20),
    ('Red Letter 12.5: The Last Day', 'https://youtu.be/ifNlS1u3Ldw', 'ifNlS1u3Ldw', 'jn12b', 30),
    ('The Heartbeat of the King: From Adam to the Throne', 'https://youtu.be/Wq00ueSP9qY', 'Wq00ueSP9qY', 'heartbeat', 10)
) as v(title, youtube_url, youtube_id, marker_id, sort_order)
where not exists (
  select 1 from public.lessons l where l.youtube_id = v.youtube_id
);

insert into public.resources (
  title, note, kind, url, marker_id, sort_order, published,
  timeline_year, timeline_month, timeline_day, timeline_label
)
select
  v.title, null, 'link', v.url, v.marker_id, v.sort_order, true,
  null, null, null, null
from (
  values
    ('Red Letter 12.3: The Hour Is Come'::text, 'https://drive.google.com/file/d/1TpXPGgHb11L1oGwsPo7NKh7X1XlBgOpi/view'::text, '1TpXPGgHb11L1oGwsPo7NKh7X1XlBgOpi'::text, 'jn12b'::text, 10),
    ('Red Letter 12.4: He Hath Blinded Their Eyes', 'https://drive.google.com/file/d/1dANdRqlZBBo_KJSs3wZvDX7FDbouvukJ/view', '1dANdRqlZBBo_KJSs3wZvDX7FDbouvukJ', 'jn12b', 20),
    ('Red Letter 12.5: The Last Day', 'https://drive.google.com/file/d/1sWtzLVSlCp5S8itgna5XZ4dYvObbAzcW/view', '1sWtzLVSlCp5S8itgna5XZ4dYvObbAzcW', 'jn12b', 30),
    ('The Heartbeat of the King: From Adam to the Throne — Study Notes', 'https://drive.google.com/file/d/1GC5H5mryhyc_m2me76Eds-k_kYe66LGC/view', '1GC5H5mryhyc_m2me76Eds-k_kYe66LGC', 'heartbeat', 1),
    ('The Heartbeat of the King: From Adam to the Throne — Six Week Study Series', 'https://drive.google.com/file/d/14T864o1SHLzfQyH8N2Bm-U9KQ0U8AjBK/view', '14T864o1SHLzfQyH8N2Bm-U9KQ0U8AjBK', 'heartbeat', 2),
    ('The Heartbeat of the King: From Adam to the Throne — Six Week Deeper Teaching', 'https://drive.google.com/file/d/1Cuxqq4MNal_7OJ5sQVmfY6u35dm3cLAK/view', '1Cuxqq4MNal_7OJ5sQVmfY6u35dm3cLAK', 'heartbeat', 3),
    ('The Heartbeat of the King: From Adam to the Throne — Companion Handout', 'https://drive.google.com/file/d/1JJ4JvFK17Fb3qgxoa8VS_fznwFTerA1W/view', '1JJ4JvFK17Fb3qgxoa8VS_fznwFTerA1W', 'heartbeat', 4)
) as v(title, url, drive_id, marker_id, sort_order)
where not exists (
  select 1 from public.resources r
  where coalesce(r.url, '') ilike '%' || v.drive_id || '%'
);

-- Safety latch. Replace this line with COMMIT only after review.
rollback;
