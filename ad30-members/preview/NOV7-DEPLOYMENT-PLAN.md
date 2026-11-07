# Nov 7 member additions — preview for review

Nothing in this folder has been applied to the live site. No branch was pushed, no pull request was opened, no SQL was run, and YouTube was not changed.

## What members would see

Open **Passover · The Cross**. After the existing entry spot (Red Letter 12.2) two new undated spots appear:

1. **John 12, after the entry** — date line `After lesson 12.2 · no day fixed`
   - Red Letter 12.3: The Hour Is Come (`W0Jiusiejwg`) with one **Study notes** button
   - Red Letter 12.4: He Hath Blinded Their Eyes (`nRCD4of7ewg`) with one **Study notes** button
   - Red Letter 12.5: The Last Day (`ifNlS1u3Ldw`) with one **Study notes** button
2. **The Heartbeat of the King** — date line `After John 12 and before John 13 · no day fixed`
   - The Heartbeat of the King: From Adam to the Throne (`Wq00ueSP9qY`)
   - Four buttons under the video, in this order: **Study Notes**, **Six Week Study Series**, **Six Week Deeper Teaching**, **Companion Handout**. Each says “opens in Google Drive”.

The single-guide label stays **Study notes**. That is the label the member page already uses for a lesson’s study guide. Heartbeat is the only lesson with more than one guide, so only Heartbeat uses the four distinct names.

Spot order inside the section:

`jn121` (12.1) → `entry` (12.2) → `jn12b` (12.3–12.5) → `heartbeat` → `n10` (10 Nisan, unchanged) → `jn131` (John 13, unchanged)

## Flag for the owner — new timeline slots

A new slot is required for Heartbeat. No existing spot means “between John 12 and John 13” without a calendar day. `n10` is Saturday 1 Apr AD 30. `jn131` is the last supper. Putting Heartbeat on either of those would assign a day.

12.3–12.5 also need a place that does not invent a day. Sharing `entry` with 12.2 would list them under **Fri 31 Mar AD 30**.

The proposal adds two undated spots in `ad30-members/js/lessons.js`, both in **The final week**, both mapped to the Passover section:

| Marker id | Shown as | Holds |
|---|---|---|
| `jn12b` | John 12, after the entry | 12.3, 12.4, 12.5 |
| `heartbeat` | The Heartbeat of the King | the standalone lesson |

They are inserted **before** the existing 10 Nisan spot so 12.3 follows 12.2. That position is lesson order, not a claim that these lessons fall before 10 Nisan. If they should sit after 10 Nisan and immediately before John 13, move the two marker objects in `lessons.js` to just before `jn131`. The video ids and the SQL marker ids would stay the same only if the ids stay `jn12b` and `heartbeat`.

These spots are not in the teacher timeline. That timeline is HTML stored in `public.teacher_content`, loaded after a leader signs in. This preview does not change that table. Until it is updated in a later approved step, the teacher page will list these four lessons under Latest lessons instead of on a marker. The member page uses the marker list in `lessons.js` and will show the spots.

## How the page stores this

Lessons are rows in `public.lessons`. Study guides are rows in `public.resources` (a Drive link, not a file uploaded into Supabase storage). The member page attaches a guide to a lesson when they share a timeline spot and the titles match. Heartbeat’s four titles start with the lesson title and end with the button name. `sort_order` 1–4 fixes the button order. There is no `lesson_id` column; the title match is the existing rule.

The anon key cannot read `public.lessons` (the request returned permission denied). This preview could not query production for duplicates. The videos are not hardcoded in the repo. The SQL inserts a row only when that YouTube id, or that Drive file id, is not already stored, and it does not update or delete anything.

## What changed in the site code

- `js/lessons.js` — the two undated markers.
- `js/lessons-member.js` and `js/tab-editor.js` — those markers belong to Passover. One guide on a lesson is unchanged.
- `js/resources.js` — when one lesson has several guides, the bold label is the title ending. A lesson with one guide still says **Study notes**.
- `css/lessons-member.css` — those several labels may wrap on a phone.
- Cache query `?v=20261107a` on the changed scripts and the member lesson stylesheet, so phones do not keep the previous copy.

Sign-in, admin checks, row-level security, and the sharing-lockdown work were not touched. `simple.html` still loads `js/config.js` and still shows the email gate. `?demo=1` does not open the member page while that config is connected. The check page confirmed `configured: true`, `demo: false`.

## Preview fixture

`preview/nov7-additions.html?demo=1#passover` is a copy of the member layout. It does **not** load `js/config.js` and does not create a database client. It uses the site’s existing demo flag, which only runs when the site is not connected. `preview/nov7-fixture.js` supplies the rows.

Lessons 11.1–11.5, 12.1, and 12.2 in that preview are **stand-ins**: the public YouTube titles and the spots already confirmed (11.1–11.5 on `jn1155`, 12.1 on `jn121`, 12.2 on `entry`). Each stand-in summary says it is not part of the insert. Their dates and sort order are fixture values, not a copy of the database. They are not in the SQL.

Do not publish the `preview/` folder on the live site. It is a review artifact. The approved release is the JavaScript, CSS, and cache-bust edits, plus the SQL after the rollback line is changed.

## SQL — do not run yet

`preview/nov7-additions.sql` begins a transaction, prints matching lesson and resource rows, inserts only missing rows, then **ROLLBACK**. Running the file as written keeps nothing. After approval, replace `rollback` with `commit`.

The insert does not set `notified`, beyond storing `false`, and it does not call the mailer. If a database trigger sends mail on insert, disable that trigger before committing.

If `video_source` or the `timeline_*` columns are not on the tables yet, remove those columns from the insert lists. `created_by` is left to the table default.

## Checks already run

`node ad30-members/preview/nov7-check.mjs` (local static server and headless Chrome only). This run installed `puppeteer-core` in `/tmp/nov7-test` and used `/usr/bin/google-chrome`. The checker does not sign in and does not open a database connection:

- Production config with `?demo=1` stays signed out.
- The live member page does not load the fixture.
- Passover shows the four new videos once each, and the seven prior videos once each.
- Exactly seven guide links, one per Drive file id.
- 12.3, 12.4, and 12.5 each have one Study notes button under the video.
- Heartbeat has four stacked buttons in the requested order, including on a 390px-wide screen, with no horizontal overflow.
- No page errors.

Screenshots: `preview/screenshots/` (desktop and mobile, John 12 block and Heartbeat).

## After approval

1. Confirm the spot position (before 10 Nisan, as proposed, or moved to just before `jn131`).
2. Publish the JavaScript, CSS, and the `?v=20261107a` tags together with the SQL commit, so the new spots are not empty.
3. Leave `preview/` off the live site.
4. Leave `public.teacher_content` for a separate decision. Members do not need that update to see the lessons.
5. Signed in as a member, open Passover and confirm the four videos, seven buttons, and that 11.1–12.2 are unchanged.
