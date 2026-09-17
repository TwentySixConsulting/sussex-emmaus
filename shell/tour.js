/* TwentySix · Zigbert — per-area guided tours.
 * Framework-agnostic: loaded on the React app AND the static Pay/Benefits pages.
 *
 * Five short, self-contained tours (3–5 steps, ~40 seconds), one per area. A tour
 * NEVER leaves its own page, so there is no navigation mid-tour. Each is offered
 * once, on first arrival at that area, so the explanation lands where the feature
 * is rather than minutes before the user gets there.
 *
 * Tours are never chained. Each one ends where it started, and the user is nudged
 * about the next area only when they navigate there themselves. The sole exception
 * is the Home checklist, where picking an area is an explicit request to go and
 * tour it; progress persists in localStorage so that survives the full-page load
 * between the three apps.
 *
 * Exposes window.ZigbertTour = {start, startTour, stop, resume}.
 */
(function () {
  "use strict";
  if (window.ZigbertTour) return; // already loaded

  var KEY = "sussex-emmaus:tour";              // { active, tour, step } — in-flight position
  var DONE = "sussex-emmaus:tour-done";        // { home: ts, pay: ts, … } — tours completed
  var OFFERED = "sussex-emmaus:tour-offered";  // { home: ts, … } — first-run prompt already shown
  var LEGACY = "sussex-emmaus:tour-seen";      // pre-split single flag, migrated on first load
  var CL_OFF = "sussex-emmaus:tour-checklist-off";

  // ── state ────────────────────────────────────────────────────
  function getState() {
    try { var r = localStorage.getItem(KEY); return r ? JSON.parse(r) : { active: false }; }
    catch (e) { return { active: false }; }
  }
  function setState(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  function clearState() { try { localStorage.removeItem(KEY); } catch (e) {} }

  function getMap(k) {
    try { var r = localStorage.getItem(k); var v = r ? JSON.parse(r) : null; return (v && typeof v === "object") ? v : {}; }
    catch (e) { return {}; }
  }
  function mark(k, tour) {
    try { var m = getMap(k); m[tour] = Date.now(); localStorage.setItem(k, JSON.stringify(m)); } catch (e) {}
  }
  function isDone(tour) { return !!getMap(DONE)[tour]; }
  function wasOffered(tour) { return !!getMap(OFFERED)[tour]; }

  // Anyone who saw the old single 28-step tour shouldn't be prompted again on Home,
  // but should still be offered the new short tours for the other areas.
  function migrateLegacy() {
    try {
      if (!localStorage.getItem(LEGACY)) return;
      var m = getMap(OFFERED);
      if (m.home) return;
      mark(OFFERED, "home");
    } catch (e) {}
  }

  function authed() {
    try {
      if (localStorage.getItem("sussex-emmaus:temp-auth")) return true;
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf("sb-") === 0 && k.indexOf("-auth-token") !== -1) return true;
      }
    } catch (e) {}
    return false;
  }

  // ── the tours ────────────────────────────────────────────────
  // One entry per area. `app`/`path` locate the tour; every step lives on that page.
  var TOURS = {
    // Home is 4 steps, following the page top to bottom: Snapshot, the three
    // area boxes, then what needs attention. It was 5 until the Quick actions
    // section was removed from Home; a step whose anchor no longer exists stalls
    // on a blank overlay for ~4s (see findTarget), so the step went with it.
    home: {
      label: "Home", secs: 30, app: "react", path: "/",
      steps: [
        { selector: "[data-tour='hero']", placement: "bottom",
          title: "Snapshot",
          html: "This is your snapshot. This shows where your reward position stands this quarter: your pay and benefits against the market range, your headcount, and anything still waiting to be benchmarked." },
        { selector: "[data-tour='explore']", placement: "top",
          title: "Pay, Benefits and Organisation",
          html: "The three areas of your dashboard, each showing a preview of what is inside. Every one has a short tour of its own the first time you open it." },
        { selector: "[data-tour='attention']", placement: "top",
          title: "What needs attention",
          html: "The things worth acting on, ranked from your own data. Each row opens the detail behind it." },
        { selector: "[data-tour='nav']", placement: "bottom",
          title: "Getting around",
          html: "Switch between areas up here at any time. <b>Tour this page</b> brings back the guide for wherever you are." },
      ],
    },

    pay: {
      label: "Pay", secs: 45, app: "pay", path: "pay",
      steps: [
        { selector: "[data-testid='nav-home']", placement: "right",
          title: "How Pay is organised",
          html: "The sidebar holds your market position, role-by-role detail, bonuses and the pay review tool." },
        { selector: "[data-testid='kpi-overall']", placement: "bottom",
          title: "Headline position",
          html: "How your overall pay compares to the market, with the number of roles below market and your total pay bill alongside." },
        { selector: "[data-testid='today-search']", placement: "bottom",
          title: "Find any role",
          html: "Search a job title to see exactly where its pay sits within the market range." },
        { selector: "[role='group'][aria-label='View pay by role or by person']", placement: "bottom",
          title: "By role or by person",
          html: "Switch the whole dashboard between role-level benchmarks and individual people with their FTE. Useful when several people share one role." },
        { selector: "[data-testid='nav-pay-review']", placement: "right",
          title: "Prep a pay review",
          html: "Model what it would cost to lift roles or people to a market target (lower quartile, median or upper quartile) and export the result." },
      ],
    },

    benefits: {
      label: "Benefits", secs: 40, app: "benefits", path: "benefits",
      steps: [
        { selector: "#bx-verdict", placement: "bottom",
          title: "Benefits position",
          html: "How competitive your overall benefits offer is against the market." },
        { selector: ".sidebar-nav", placement: "right",
          title: "The categories",
          html: "Your benefits are grouped down the left. Core, working time, wellbeing, financial support, ESG &amp; DEI, and learning." },
        { selector: "#bx-search", placement: "bottom",
          title: "Find a benefit",
          html: "Search any benefit, such as pension, sick pay or leave, to see how yours compares." },
        { selector: ".navlink[data-page='action-plan']", placement: "right",
          title: "The action plan",
          html: "A prioritised view of where to focus your benefits spend, ready to export." },
      ],
    },

    organisation: {
      label: "Organisation", secs: 35, app: "react", path: "/organisation",
      steps: [
        { selector: "[data-tour='summary']", placement: "bottom",
          title: "What's in here",
          html: "Your roles, people and benefits in one place, plus anything currently with your consultant to benchmark." },
        { selector: "[aria-label='View by role or by person']", placement: "bottom",
          title: "Roles or people",
          html: "Manage your data by role, or by individual person and FTE, the same choice you get in Pay." },
        { selector: "[data-tour^='add']", placement: "bottom",
          title: "Add for benchmarking",
          html: "Add a role, a person or a benefit and send it to your TwentySix consultant to benchmark." },
        { selector: "[data-tour='roles-table']", placement: "top",
          title: "Edits flow through",
          html: "Change a salary or a detail here and it feeds straight into your Pay dashboard. Benefits work the same way, further down the page." },
      ],
    },

    account: {
      label: "Account", secs: 20, app: "react", path: "/account",
      steps: [
        { selector: "[data-tour='subscriptions']", placement: "bottom",
          title: "Subscriptions",
          html: "What you're subscribed to and what each product covers. Billing, invoices and email preferences are below." },
        { selector: "[data-tour='support']", placement: "top",
          title: "Getting help",
          html: "Your TwentySix consultant's details, whenever you want a second opinion on the numbers." },
      ],
    },
  };

  var ORDER = ["home", "pay", "benefits", "organisation", "account"];

  // ── location helpers (base-path aware: works at "/" and "/demo2-client-dashboard/") ──
  function siteRoot() {
    var p = location.pathname;
    p = p.replace(/\/index\.html$/, "/");
    p = p.replace(/\/(pay|benefits)(\/.*)?$/, "/");
    // Every top-level React route has to be stripped here, tourless ones
    // included. This file loads on React pages, so at /trends nothing matched
    // and siteRoot() returned ".../trends/" — which then sent an active tour to
    // ".../trends/pay/". Adding a section without adding it here breaks the tour
    // silently, from that page only.
    p = p.replace(/\/(organisation|account|trends|methodology|report)\/?$/, "/");
    if (p.charAt(p.length - 1) !== "/") p += "/";
    return p;
  }
  function here() {
    var p = location.pathname;
    if (/\/pay(\/|$)/.test(p)) return { app: "pay", path: "pay" };
    if (/\/benefits(\/|$)/.test(p)) return { app: "benefits", path: "benefits" };
    if (/\/organisation\/?$/.test(p)) return { app: "react", path: "/organisation" };
    if (/\/account\/?$/.test(p)) return { app: "react", path: "/account" };
    // Pages with no tour of their own. They MUST be named here: the fallthrough
    // below claims any unrecognised path is Home, so on /trends the Home tour
    // would run against selectors that don't exist (findTarget polls ~4s per
    // step, so it just sits there looking broken), clicking to the end would
    // mark HOME as toured, and maybeOffer() would fire the welcome prompt on the
    // wrong page. Returning an app no TOURS entry uses makes tourHere() null,
    // and both start() and maybeOffer() already guard on that.
    if (/\/(trends|methodology|report)(\/|$)/.test(p)) return { app: "none", path: p };
    return { app: "react", path: "/" };
  }
  function urlFor(key) {
    var t = TOURS[key], root = siteRoot();
    if (t.app === "pay") return root + "pay/";
    if (t.app === "benefits") return root + "benefits/";
    if (t.path === "/organisation") return root + "organisation";
    if (t.path === "/account") return root + "account";
    return root;
  }
  // which tour belongs to the page we're on right now
  function tourHere() {
    var h = here();
    for (var i = 0; i < ORDER.length; i++) {
      var t = TOURS[ORDER[i]];
      if (t.app !== h.app) continue;
      if (t.app === "react" && t.path !== h.path) continue;
      return ORDER[i];
    }
    return null;
  }
  function isHere(key) { return tourHere() === key; }

  // ── DOM ──────────────────────────────────────────────────────
  var root = null, hole = null, card = null, catcher = null;
  var reposition = null, findTimer = null, navigating = false;

  function build() {
    if (root) return;
    root = document.createElement("div");
    root.className = "ztour-root";
    root.innerHTML =
      '<div class="ztour-catch"></div>' +
      '<div class="ztour-hole"></div>' +
      '<div class="ztour-card" role="dialog" aria-modal="true" aria-labelledby="ztour-title">' +
        '<button class="ztour-close" aria-label="Close tour">×</button>' +
        '<div class="ztour-progress"><span class="ztour-bar"></span></div>' +
        '<div class="ztour-count"></div>' +
        '<h3 class="ztour-title" id="ztour-title"></h3>' +
        '<div class="ztour-body"></div>' +
        '<div class="ztour-foot">' +
          '<button class="ztour-skip" type="button">Skip</button>' +
          '<div class="ztour-nav">' +
            '<button class="ztour-back" type="button">Back</button>' +
            '<button class="ztour-next ztour-primary" type="button">Next</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(root);
    hole = root.querySelector(".ztour-hole");
    card = root.querySelector(".ztour-card");
    catcher = root.querySelector(".ztour-catch");

    catcher.addEventListener("click", stop);
    root.querySelector(".ztour-close").addEventListener("click", stop);
    root.querySelector(".ztour-skip").addEventListener("click", stop);
    root.querySelector(".ztour-back").addEventListener("click", back);
    root.querySelector(".ztour-next").addEventListener("click", onNext);
    card.addEventListener("click", function (e) { e.stopPropagation(); });
    document.addEventListener("keydown", onKey, true);
  }

  function teardown() {
    if (reposition) { window.removeEventListener("scroll", reposition, true); window.removeEventListener("resize", reposition); reposition = null; }
    if (findTimer) { clearInterval(findTimer); findTimer = null; }
    document.removeEventListener("keydown", onKey, true);
    if (root && root.parentNode) root.parentNode.removeChild(root);
    root = hole = card = catcher = null;
  }

  function onKey(e) {
    if (!root) return;
    if (e.key === "Escape") { e.preventDefault(); stop(); }
    else if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); onNext(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); back(); }
  }

  // ── positioning ──────────────────────────────────────────────
  function findTarget(sel, cb) {
    if (findTimer) { clearInterval(findTimer); findTimer = null; }
    var el = sel ? document.querySelector(sel) : null;
    if (el || !sel) { cb(el); return; }
    var tries = 0;
    findTimer = setInterval(function () {
      tries++;
      var found = document.querySelector(sel);
      if (found || tries > 40) { clearInterval(findTimer); findTimer = null; cb(found || null); }
    }, 100); // up to ~4s for late-rendered targets
  }

  function place(el) {
    if (reposition) { window.removeEventListener("scroll", reposition, true); window.removeEventListener("resize", reposition); }
    reposition = function () { position(el); };
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    position(el);
  }

  function position(el) {
    if (!root) return;
    var vw = window.innerWidth, vh = window.innerHeight, pad = 8, gap = 14;
    if (!el) {
      hole.style.display = "none";
      card.style.left = Math.round((vw - card.offsetWidth) / 2) + "px";
      card.style.top = Math.round((vh - card.offsetHeight) / 2) + "px";
      return;
    }
    var r = el.getBoundingClientRect();
    hole.style.display = "block";
    hole.style.left = (r.left - pad) + "px";
    hole.style.top = (r.top - pad) + "px";
    hole.style.width = (r.width + pad * 2) + "px";
    hole.style.height = (r.height + pad * 2) + "px";

    var cw = card.offsetWidth, ch = card.offsetHeight;
    var pref = card.getAttribute("data-place") || "bottom";
    var spot = { bottom: vh - r.bottom, top: r.top, right: vw - r.right, left: r.left };
    var order = [pref, "bottom", "top", "right", "left"];
    var chosen = "bottom";
    for (var i = 0; i < order.length; i++) {
      var p = order[i];
      if ((p === "bottom" || p === "top") && spot[p] >= ch + gap + pad) { chosen = p; break; }
      if ((p === "left" || p === "right") && spot[p] >= cw + gap + pad) { chosen = p; break; }
    }
    var left, top;
    if (chosen === "bottom" || chosen === "top") {
      left = r.left + r.width / 2 - cw / 2;
      top = chosen === "bottom" ? r.bottom + gap : r.top - ch - gap;
    } else {
      top = r.top + r.height / 2 - ch / 2;
      left = chosen === "right" ? r.right + gap : r.left - cw - gap;
    }
    left = Math.max(pad, Math.min(left, vw - cw - pad));
    top = Math.max(pad, Math.min(top, vh - ch - pad));
    card.style.left = Math.round(left) + "px";
    card.style.top = Math.round(top) + "px";
  }

  // ── rendering a step ─────────────────────────────────────────
  function showStep(key, i) {
    var tour = TOURS[key], steps = tour.steps, step = steps[i], last = i === steps.length - 1;
    build();

    // Reaching the final card counts as completing the tour, however it's closed.
    if (last) { mark(DONE, key); renderChecklist(); }

    card.setAttribute("data-place", step.placement || "bottom");
    root.querySelector(".ztour-title").innerHTML = step.title;
    root.querySelector(".ztour-body").innerHTML = step.html;
    root.querySelector(".ztour-count").textContent = tour.label + " · " + (i + 1) + " of " + steps.length;
    root.querySelector(".ztour-bar").style.width = Math.round(((i + 1) / steps.length) * 100) + "%";
    root.querySelector(".ztour-back").style.visibility = i === 0 ? "hidden" : "visible";

    // Every tour ends where it started. The next area is never chained on; the
    // user gets nudged when they navigate there themselves (see maybeOffer).
    var skipBtn = root.querySelector(".ztour-skip");
    var nextBtn = root.querySelector(".ztour-next");
    skipBtn.style.display = last ? "none" : "";
    if (!last) skipBtn.textContent = "Skip";
    nextBtn.textContent = last ? "Done" : "Next";
    nextBtn.setAttribute("data-last", last ? "1" : "");

    findTarget(step.selector, function (el) {
      if (!root) return;
      if (el && el.scrollIntoView) el.scrollIntoView({ block: "center", behavior: "smooth" });
      setTimeout(function () { place(el); root.classList.add("ztour-in"); }, el ? 260 : 0);
    });
  }

  // show the current step, or navigate to the tour that owns it
  function render() {
    var s = getState();
    if (!s.active || !TOURS[s.tour]) { teardown(); return; }
    var tour = TOURS[s.tour];
    var i = Math.max(0, Math.min(s.step || 0, tour.steps.length - 1));

    if (isHere(s.tour)) {
      navigating = false;
      try { sessionStorage.removeItem("ztour-nav"); } catch (e) {}
      showStep(s.tour, i);
      return;
    }
    if (navigating) return;

    // Loop guard: if we just navigated here for this same tour and landed
    // somewhere else, give up quietly rather than ping-pong.
    var g = null;
    try { g = JSON.parse(sessionStorage.getItem("ztour-nav") || "null"); } catch (e) {}
    if (g && g.tour === s.tour && (Date.now() - g.t) < 5000) { stop(); return; }
    try { sessionStorage.setItem("ztour-nav", JSON.stringify({ tour: s.tour, t: Date.now() })); } catch (e) {}
    navigating = true;
    window.location.href = urlFor(s.tour);
  }

  function go(delta) {
    var s = getState();
    if (!s.active || !TOURS[s.tour]) return;
    var n = TOURS[s.tour].steps.length;
    var i = Math.max(0, Math.min((s.step || 0) + delta, n - 1));
    setState({ active: true, tour: s.tour, step: i });
    render();
  }
  function back() { go(-1); }

  function onNext() {
    var btn = root && root.querySelector(".ztour-next");
    if (btn && btn.getAttribute("data-last")) { stop(); return; }
    go(1);
  }

  function startTour(key) {
    if (!TOURS[key]) return;
    mark(OFFERED, key);
    dismissPrompt();
    setState({ active: true, tour: key, step: 0 });
    navigating = false;
    teardown();
    render();
  }
  // "Tour this page" — whatever page the user is standing on
  function start() {
    var key = tourHere();
    if (key) startTour(key);
  }
  function stop() {
    clearState();
    teardown();
    renderChecklist();
  }
  function resume() { render(); }

  // ── first-run prompt, once per area ──────────────────────────
  var prompt = null;
  function dismissPrompt() {
    if (prompt && prompt.parentNode) prompt.parentNode.removeChild(prompt);
    prompt = null;
  }
  function maybeOffer() {
    if (!authed() || getState().active || prompt) return;
    var key = tourHere();
    if (!key || wasOffered(key) || isDone(key)) return;
    var t = TOURS[key];
    var first = key === "home";

    prompt = document.createElement("div");
    prompt.className = "ztour-welcome";
    prompt.innerHTML =
      '<div class="ztour-welcome-title">' +
        (first ? "Welcome to Zigbert" : t.label + ", in brief") +
      '</div>' +
      '<div class="ztour-welcome-body">' +
        (first
          ? "A " + t.secs + "-second look around your home page. Each area has its own short tour when you get there."
          : "A " + t.secs + "-second tour of what's here and how to use it.") +
      '</div>' +
      '<div class="ztour-welcome-foot">' +
        '<button class="ztour-welcome-later" type="button">Not now</button>' +
        '<button class="ztour-welcome-start ztour-primary" type="button">Show me</button>' +
      '</div>';
    document.body.appendChild(prompt);
    var p = prompt;
    requestAnimationFrame(function () { p.classList.add("ztour-in"); });

    p.querySelector(".ztour-welcome-later").addEventListener("click", function () {
      mark(OFFERED, key); dismissPrompt(); renderChecklist();
    });
    p.querySelector(".ztour-welcome-start").addEventListener("click", function () { startTour(key); });
  }

  // ── Home checklist: [data-zigbert-tour-checklist] ────────────
  function checklistOff() { try { return !!localStorage.getItem(CL_OFF); } catch (e) { return false; } }
  function renderChecklist() {
    var mount = document.querySelector("[data-zigbert-tour-checklist]");
    if (!mount) return;
    var done = getMap(DONE);
    var count = 0;
    for (var i = 0; i < ORDER.length; i++) if (done[ORDER[i]]) count++;

    // gone once every area is toured, or once dismissed
    if (checklistOff() || count === ORDER.length) { mount.innerHTML = ""; return; }

    var rows = ORDER.map(function (k) {
      var t = TOURS[k], ok = !!done[k];
      return '<button type="button" class="ztour-cl-row' + (ok ? " is-done" : "") + '" data-ztour-go="' + k + '">' +
          '<span class="ztour-cl-tick" aria-hidden>' + (ok ? "✓" : "") + '</span>' +
          '<span class="ztour-cl-label">' + t.label + '</span>' +
          (ok ? '<span class="ztour-cl-meta">Toured</span>'
              : '<span class="ztour-cl-meta">' + t.secs + "s</span><span class=\"ztour-cl-go\" aria-hidden>▸</span>") +
        '</button>';
    }).join("");

    mount.innerHTML =
      '<div class="ztour-cl">' +
        '<div class="ztour-cl-head">' +
          '<span class="ztour-cl-title">Getting started</span>' +
          '<span class="ztour-cl-count">' + count + " of " + ORDER.length + " areas</span>" +
        '</div>' +
        '<div class="ztour-cl-track"><span class="ztour-cl-fill" style="width:' + Math.round((count / ORDER.length) * 100) + '%"></span></div>' +
        '<div class="ztour-cl-rows">' + rows + '</div>' +
        '<button type="button" class="ztour-cl-dismiss">Dismiss</button>' +
      '</div>';

    mount.querySelector(".ztour-cl-dismiss").addEventListener("click", function () {
      try { localStorage.setItem(CL_OFF, "1"); } catch (e) {}
      mount.innerHTML = "";
    });
  }

  // ── delegated clicks: launchers + checklist rows ─────────────
  document.addEventListener("click", function (e) {
    var t = e.target;
    while (t && t !== document.body) {
      if (t.getAttribute) {
        var go = t.getAttribute("data-ztour-go");
        if (go) { e.preventDefault(); startTour(go); return; }
        var launch = t.getAttribute("data-zigbert-tour-start");
        if (launch !== null) {
          e.preventDefault();
          // Only treat the value as a tour name if it actually names one. React
          // renders the valueless JSX attribute as "true", and the static shells
          // use a bare attribute (""), so anything unrecognised means "this page".
          if (TOURS[launch]) startTour(launch); else start();
          return;
        }
      }
      t = t.parentNode;
    }
  });

  window.ZigbertTour = { start: start, startTour: startTour, stop: stop, resume: resume, tours: TOURS };

  function init() {
    migrateLegacy();
    // This script is `defer`red, so on the React app it runs before Home mounts.
    // Poll briefly for the checklist mount rather than guessing at a delay.
    renderChecklist();
    if (!document.querySelector("[data-zigbert-tour-checklist]")) {
      var tries = 0;
      var clTimer = setInterval(function () {
        tries++;
        if (document.querySelector("[data-zigbert-tour-checklist]")) { clearInterval(clTimer); renderChecklist(); }
        else if (tries > 40) clearInterval(clTimer);
      }, 100);
    }
    if (getState().active) { navigating = false; render(); }
    else setTimeout(maybeOffer, 900);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
