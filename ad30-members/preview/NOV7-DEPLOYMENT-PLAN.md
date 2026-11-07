# Nov 7 additions — publish sequence

Owner approved this batch on 7 Nov 2026, 17:09 Manila. The four videos and seven PDFs are not on the member site until the database rows exist. This connector cannot see project `wwmdvausfdqxcaaunnhu`, so those rows were not inserted. The other connected projects were not used.

## What is safe to publish before the rows

The site change adds the two timeline spots and the four Heartbeat button labels. Members do not see `jn12b` or `heartbeat` until a lesson is stored on that spot, so publishing the code alone does not add empty spots and does not show the videos. Existing lessons stay as they are. Sign-in is unchanged.

After the rows are inserted, Passover shows:

1. Red Letter 12.3, 12.4, and 12.5 on `jn12b` (`After lesson 12.2 · no day fixed`), each with one **Study notes** button.
2. The Heartbeat of the King on `heartbeat` (`After John 12 and before John 13 · no day fixed`), with four buttons under the video: **Study Notes**, **Six Week Study Series**, **Six Week Deeper Teaching**, **Companion Handout**.

Those spots sit after 12.2 (`entry`) and before the existing 10 Nisan spot. That is lesson order, not a claim they fall before 10 Nisan.

## Order

1. Merge the site change to `main`. GitHub Pages publishes it. The member page still looks as it does today.
2. Open the SQL editor for **only** `https://supabase.com/dashboard/project/wwmdvausfdqxcaaunnhu`.
3. Run `ad30-members/preview/nov7-additions.sql`. It commits. It inserts a lesson or a Drive link only when that YouTube id or Drive file id is not already there. It does not update or delete existing rows.
4. Do not run that file on `wtdagmcnnotbjvekynqa` or `hsnwopektgtudzifmhur`.
5. Sign in on https://godstimeclock.com/ad30-members/simple.html , open Passover, and confirm the four videos and seven buttons. A hard refresh loads `?v=20261107a`.

Running the SQL before the site change puts the four lessons in More lessons, and Heartbeat’s buttons all say Study notes, until the new JavaScript is loaded.

## Still not done here

- No database write. The connected Supabase account does not include `wwmdvausfdqxcaaunnhu`.
- Teacher timeline HTML in `public.teacher_content` is unchanged. On the teacher page these four show under Latest lessons until that HTML is updated separately.
- The ungated preview page is not part of this publish. The videos stay behind the member sign-in once the rows exist.
