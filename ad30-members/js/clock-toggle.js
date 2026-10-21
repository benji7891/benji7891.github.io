/* [clock-toggle] Show/Hide God's Time Clock on the member page. New file, Oct 20, 2026.
   Default: shown. Choice saved per device in localStorage "ad30.clockShown" ("1" / "0").
   The button only appears while the member page (#page) is showing and the clock panel exists. */
(function () {
  var KEY = "ad30.clockShown", root = document.documentElement;
  var ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
  function shown() { return !root.classList.contains("gtc-off"); }
  function save(on) { try { localStorage.setItem(KEY, on ? "1" : "0"); } catch (e) {} }
  function start() {
    var page = document.getElementById("page");
    if (!page || !document.getElementById("gtcPanel")) return;
    var b = document.createElement("button");
    b.type = "button"; b.className = "gtc-toggle"; b.setAttribute("aria-controls", "gtcPanel");
    function paint() {
      var on = shown();
      b.innerHTML = ICON;
      b.setAttribute("aria-label", on ? "Hide clock" : "Show clock");
      b.title = on ? "Hide clock" : "Show clock";
      b.setAttribute("aria-pressed", on ? "true" : "false");
    }
    b.addEventListener("click", function () { root.classList.toggle("gtc-off"); save(shown()); paint(); });
    paint();
    document.body.appendChild(b);
    function sync() { b.hidden = page.hidden; document.body.classList.toggle("has-gtc-toggle", !page.hidden); }
    sync();
    if (window.MutationObserver) new MutationObserver(sync).observe(page, { attributes: true, attributeFilter: ["hidden"] });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
