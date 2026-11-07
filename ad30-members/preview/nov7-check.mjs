/* Preview checks for the Nov 7 member additions. Serves the repo and drives the
   labeled fixture page. Does not sign in, and does not write to the database. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
const puppeteerRoot = ["/tmp/nov7-test/package.json", new URL("./package.json", import.meta.url).pathname].find((p) => existsSync(p));
if (!puppeteerRoot) throw new Error("Install puppeteer-core first (this run used npm install puppeteer-core in /tmp/nov7-test). Chrome: /usr/bin/google-chrome");
const require = createRequire(puppeteerRoot);
const puppeteer = require("puppeteer-core");

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".webmanifest": "application/manifest+json", ".txt": "text/plain" };
const NEW_IDS = ["W0Jiusiejwg", "nRCD4of7ewg", "ifNlS1u3Ldw", "Wq00ueSP9qY"];
const PRIOR_IDS = ["pfJTMPaLD-c", "Kvp2b-VN9QE", "MWhTrJgDArA", "OirVfIQTZgc", "w3TQfxJlrp0", "MpstCh-81kQ", "Spnq98mXzDg"];
const DRIVES = [
  "1TpXPGgHb11L1oGwsPo7NKh7X1XlBgOpi",
  "1dANdRqlZBBo_KJSs3wZvDX7FDbouvukJ",
  "1sWtzLVSlCp5S8itgna5XZ4dYvObbAzcW",
  "1GC5H5mryhyc_m2me76Eds-k_kYe66LGC",
  "14T864o1SHLzfQyH8N2Bm-U9KQ0U8AjBK",
  "1Cuxqq4MNal_7OJ5sQVmfY6u35dm3cLAK",
  "1JJ4JvFK17Fb3qgxoa8VS_fznwFTerA1W"
];
const HB_LABELS = ["Study Notes", "Six Week Study Series", "Six Week Deeper Teaching", "Companion Handout"];
const fails = [];
function check(name, ok, detail) {
  const line = (ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : "");
  console.log(line);
  if (!ok) fails.push(line);
}

function startServer() {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      let path = decodeURIComponent(url.pathname).replace(/^\/+/, "");
      if (!path || path.endsWith("/")) path += "index.html";
      if (path.split("/").includes("..")) { res.writeHead(403); res.end("no"); return; }
      const file = join(ROOT, path);
      const body = await readFile(file);
      res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream", "cache-control": "no-store" });
      res.end(body);
    } catch (e) {
      res.writeHead(404); res.end(String(e && e.message || e));
    }
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

const server = await startServer();
const port = server.address().port;
const base = "http://127.0.0.1:" + port;
const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars"]
});

try {
  const guard = await browser.newPage();
  await guard.goto(base + "/ad30-members/preview/nov7-auth-guard.html?demo=1", { waitUntil: "domcontentloaded" });
  const guardJson = JSON.parse(await guard.$eval("#out", (el) => el.textContent));
  check("production config stays connected", guardJson.configured === true, JSON.stringify(guardJson));
  check("?demo=1 does not bypass production sign-in", guardJson.demo === false && guardJson.hasClient === false, JSON.stringify(guardJson));
  await guard.close();

  const simple = await readFile(join(ROOT, "ad30-members/simple.html"), "utf8");
  check("live member page does not load the fixture", !simple.includes("nov7-fixture") && simple.includes('src="js/config.js"'));
  check("live member page still has the sign-in gate", simple.includes('id="gate"') && simple.includes("Email me a sign-in link"));

  async function openPreview(width, height) {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: width < 500 ? 2 : 1 });
    const errors = [];
    page.on("pageerror", (err) => errors.push(String(err)));
    await page.goto(base + "/ad30-members/preview/nov7-additions.html?demo=1#passover", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector("#lxm-Wq00ueSP9qY .lxm-guide-multi .lxm-guide-a", { timeout: 20000 });
    return { page, errors };
  }

  const desk = await openPreview(1440, 900);
  const report = await desk.page.evaluate((hbLabels) => {
    function buttons(id) {
      const art = document.getElementById("lxm-" + id);
      if (!art) return null;
      const media = art.querySelector(".lx-media");
      const guide = art.querySelector(".lxm-guide");
      const links = [].map.call(art.querySelectorAll(".lxm-guide-a"), (a) => ({
        label: (a.querySelector("b") || {}).textContent || "",
        small: (a.querySelector("small") || {}).textContent || "",
        href: a.getAttribute("href") || "",
        top: a.getBoundingClientRect().top,
        overflow: a.scrollWidth - a.clientWidth
      }));
      const mr = media ? media.getBoundingClientRect() : null;
      const gr = guide ? guide.getBoundingClientRect() : null;
      return {
        title: (art.querySelector(".lxm-t") || {}).textContent || "",
        links,
        multi: !!(guide && guide.classList.contains("lxm-guide-multi")),
        guideBelowVideo: !!(mr && gr && gr.top >= mr.bottom - 1),
        summary: (art.querySelector(".lxm-sum") || {}).textContent || ""
      };
    }
    const spots = [].map.call(document.querySelectorAll("#s-passover [data-spot]"), (el) => el.getAttribute("data-spot"));
    const titles = [].map.call(document.querySelectorAll("#s-passover .lxm-t"), (el) => el.textContent);
    const ids = [].map.call(document.querySelectorAll("#s-passover article.lxm-l"), (el) => (el.id || "").replace(/^lxm-/, ""));
    const allHrefs = [].map.call(document.querySelectorAll(".lxm-guide-a"), (a) => a.getAttribute("href") || "");
    const jn12bDate = (document.querySelector("#spot-jn12b .lxm-sd") || {}).textContent || "";
    const hbDate = (document.querySelector("#spot-heartbeat .lxm-sd") || {}).textContent || "";
    const hbArt = document.getElementById("lxm-Wq00ueSP9qY");
    const hbBoxes = hbArt ? [].map.call(hbArt.querySelectorAll(".lxm-guide-a"), (a) => {
      const r = a.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, height: r.height, overflow: a.scrollWidth - a.clientWidth, label: (a.querySelector("b") || {}).textContent };
    }) : [];
    return {
      demo: !!(window.AD30 && window.AD30.demo),
      configured: !!(window.AD30 && window.AD30.configured),
      client: !!(window.AD30 && window.AD30.sb),
      banner: (document.querySelector(".preview-banner") || {}).textContent || "",
      passoverOpen: document.getElementById("s-passover") ? document.getElementById("s-passover").classList.contains("open") : false,
      spots, titles, ids, allHrefs, jn12bDate, hbDate,
      cards: {
        "12.3": buttons("W0Jiusiejwg"),
        "12.4": buttons("nRCD4of7ewg"),
        "12.5": buttons("ifNlS1u3Ldw"),
        hb: buttons("Wq00ueSP9qY")
      },
      hbBoxes,
      hbLabels,
      fixture: !!(window.__NOV7_FIXTURE && window.__NOV7_FIXTURE.label)
    };
  }, HB_LABELS);

  check("fixture page is demo and not connected", report.demo === true && report.configured === false && report.client === false, JSON.stringify({ demo: report.demo, configured: report.configured, client: report.client }));
  check("fixture banner is visible", /PREVIEW FIXTURE/.test(report.banner) && /not the live site/.test(report.banner));
  check("fixture flag is set", report.fixture === true);
  check("Passover section is open", report.passoverOpen === true);
  check("no page errors on desktop", desk.errors.length === 0, desk.errors.join(" | "));

  const spotIdx = (id) => report.spots.indexOf(id);
  check("12.3–12.5 spot follows 12.2 and precedes Heartbeat", spotIdx("entry") >= 0 && spotIdx("entry") < spotIdx("jn12b") && spotIdx("jn12b") < spotIdx("heartbeat") && spotIdx("heartbeat") < spotIdx("n10") && spotIdx("n10") < spotIdx("jn131"), report.spots.filter((id) => ["jn121", "entry", "jn12b", "heartbeat", "n10", "jn131"].includes(id)).join(" > "));
  check("new spots do not invent a weekday", report.jn12bDate === "After lesson 12.2 · no day fixed" && report.hbDate === "After John 12 and before John 13 · no day fixed", report.jn12bDate + " | " + report.hbDate);

  const order = ["Red Letter 11.1:", "Red Letter 11.2:", "Red Letter 11.3:", "Red Letter 11.4:", "Red Letter 11.5:", "Red Letter 12.1:", "Red Letter 12.2:", "Red Letter 12.3:", "Red Letter 12.4:", "Red Letter 12.5:", "The Heartbeat of the King:"];
  const pos = order.map((t) => report.titles.findIndex((x) => x.indexOf(t) === 0));
  check("lesson number order is 11.1 through Heartbeat", pos.every((n, i) => n >= 0 && (i === 0 || n > pos[i - 1])), pos.join(","));

  const seen = {};
  report.ids.forEach((id) => { seen[id] = (seen[id] || 0) + 1; });
  NEW_IDS.concat(PRIOR_IDS).forEach((id) => check("video " + id + " shown once", seen[id] === 1, "count " + (seen[id] || 0)));
  check("no unexpected videos in Passover", report.ids.length === NEW_IDS.length + PRIOR_IDS.length, String(report.ids.length));

  check("exactly seven guide buttons", report.allHrefs.length === 7, String(report.allHrefs.length));
  DRIVES.forEach((id) => check("guide " + id, report.allHrefs.some((h) => h.indexOf("/file/d/" + id + "/view") >= 0)));

  ["12.3", "12.4", "12.5"].forEach((key) => {
    const card = report.cards[key];
    check(key + " has one Study notes button under the video", !!card && card.links.length === 1 && card.links[0].label === "Study notes" && card.guideBelowVideo && card.multi === false, JSON.stringify(card && { n: card.links.length, label: card.links[0] && card.links[0].label, below: card.guideBelowVideo, multi: card.multi }));
    check(key + " is not a stand-in", !!card && card.summary.indexOf("Fixture stand-in") < 0);
  });
  check("12.2 stand-in is labeled and has no new guide", (report.cards && true) && report.titles.some((t) => t.indexOf("Red Letter 12.2:") === 0));
  const standIn = await desk.page.$eval("#lxm-Spnq98mXzDg", (el) => ({ summary: (el.querySelector(".lxm-sum") || {}).textContent || "", guides: el.querySelectorAll(".lxm-guide-a").length }));
  check("12.2 stand-in summary is labeled and has no guide button", /Fixture stand-in/.test(standIn.summary) && standIn.guides === 0, JSON.stringify(standIn));

  const hb = report.cards.hb;
  check("Heartbeat has four buttons under the video", !!hb && hb.links.length === 4 && hb.multi === true && hb.guideBelowVideo, JSON.stringify(hb && { n: hb.links.length, multi: hb.multi, below: hb.guideBelowVideo }));
  check("Heartbeat button labels and order", !!hb && hb.links.map((l) => l.label).join(" | ") === HB_LABELS.join(" | "), hb && hb.links.map((l) => l.label).join(" | "));
  check("Heartbeat buttons open in Drive", !!hb && hb.links.every((l) => /opens in Google Drive/.test(l.small) && /drive\.google\.com/.test(l.href)));
  const stacked = report.hbBoxes.every((b, i) => i === 0 || b.top >= report.hbBoxes[i - 1].bottom - 1);
  check("Heartbeat buttons stack without overlap", stacked && report.hbBoxes.every((b) => b.height >= 44 && b.overflow <= 1), JSON.stringify(report.hbBoxes));

  const shotDir = "/opt/cursor/artifacts";
  const localDir = fileURLToPath(new URL("./screenshots/", import.meta.url));
  await mkdir(shotDir, { recursive: true });
  await mkdir(localDir, { recursive: true });
  await desk.page.$eval("#spot-jn12b", (el) => el.scrollIntoView({ block: "start" }));
  await desk.page.screenshot({ path: shotDir + "/nov7-desktop-john12.png" });
  await desk.page.screenshot({ path: localDir + "nov7-desktop-john12.png" });
  await desk.page.$eval("#lxm-Wq00ueSP9qY", (el) => el.scrollIntoView({ block: "center" }));
  await desk.page.screenshot({ path: shotDir + "/nov7-desktop-heartbeat.png" });
  await desk.page.screenshot({ path: localDir + "nov7-desktop-heartbeat.png" });
  await desk.page.close();

  const phone = await openPreview(390, 844);
  check("no page errors on mobile", phone.errors.length === 0, phone.errors.join(" | "));
  const mobile = await phone.page.evaluate(() => {
    const art = document.getElementById("lxm-Wq00ueSP9qY");
    const links = art ? [].map.call(art.querySelectorAll(".lxm-guide-a b"), (b) => ({
      text: b.textContent,
      overflow: b.scrollWidth - b.clientWidth,
      whiteSpace: getComputedStyle(b).whiteSpace
    })) : [];
    const btn = art ? art.querySelector(".lxm-guide-a") : null;
    return { links, buttonOverflow: btn ? btn.scrollWidth - btn.clientWidth : 99, pageHidden: document.getElementById("page").hidden };
  });
  check("mobile Heartbeat labels wrap and stay readable", mobile.links.map((l) => l.text).join(" | ") === HB_LABELS.join(" | ") && mobile.links.every((l) => l.whiteSpace === "normal") && mobile.buttonOverflow <= 1 && mobile.pageHidden === false, JSON.stringify(mobile));
  await phone.page.$eval("#lxm-Wq00ueSP9qY .lxm-guide", (el) => el.scrollIntoView({ block: "center" }));
  await phone.page.screenshot({ path: shotDir + "/nov7-mobile-heartbeat.png" });
  await phone.page.screenshot({ path: localDir + "nov7-mobile-heartbeat.png" });
  await phone.page.$eval("#spot-jn12b", (el) => el.scrollIntoView({ block: "start" }));
  await phone.page.screenshot({ path: shotDir + "/nov7-mobile-john12.png" });
  await phone.page.screenshot({ path: localDir + "nov7-mobile-john12.png" });
  await phone.page.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

if (fails.length) {
  console.error("\n" + fails.length + " failed");
  process.exit(1);
}
console.log("\nAll checks passed");
