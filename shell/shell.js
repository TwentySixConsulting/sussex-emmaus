/* TwentySix · Zigbert — Unified Shell controller (static pages only)
 *
 * - Auth gate: redirects to "/" if no auth marker is present in localStorage.
 *   Honours both the temp-auth key (used until Supabase env vars are wired)
 *   and any Supabase auth token under sb-*-auth-token.
 * - Reads the username + synthesised email so the user pill matches what
 *   the React Home page shows.
 * - Dropdown open/close + click-outside.
 * - Sign out clears local auth markers and bounces back to "/".
 * - Highlights the active tab using the current pathname.
 *
 * The React Home page renders its own equivalent header with the same look —
 * this script does NOT run there.
 */
(function () {
  "use strict";

  var TEMP_AUTH_KEY = "sussex-emmaus:temp-auth";

  // Platform home, base-path aware — works at "/" and under a Pages sub-path
  // ("/<repo>/pay/…" → "/<repo>/"). Strips the trailing pay|benefits section.
  function homePath() {
    var p = window.location.pathname.replace(/\/(pay|benefits)(\/.*)?$/, "");
    return (p || "") + "/";
  }

  // ── Auth gate ───────────────────────────────────────────────
  // Runs immediately on script execution (we use defer so DOM is ready).
  function readAuth() {
    try {
      var raw = window.localStorage.getItem(TEMP_AUTH_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.username) {
          return { username: String(parsed.username) };
        }
      }
    } catch (e) {
      // ignore parse errors
    }

    // Supabase fallback — sb-<projectref>-auth-token
    try {
      for (var i = 0; i < window.localStorage.length; i++) {
        var key = window.localStorage.key(i);
        if (key && key.indexOf("sb-") === 0 && key.indexOf("-auth-token") !== -1) {
          var sbRaw = window.localStorage.getItem(key);
          if (sbRaw) {
            try {
              var sbParsed = JSON.parse(sbRaw);
              var email =
                (sbParsed && sbParsed.user && sbParsed.user.email) ||
                (sbParsed && sbParsed.currentSession && sbParsed.currentSession.user && sbParsed.currentSession.user.email);
              if (email) {
                return { username: String(email).split("@")[0], email: String(email) };
              }
            } catch (e2) {
              // fall through
            }
          }
        }
      }
    } catch (e) { /* ignore */ }

    return null;
  }

  var auth = readAuth();
  if (!auth) {
    // Bounce to login. replace() avoids back-button bouncing here.
    window.location.replace(homePath());
    return;
  }

  // ── DOM wiring ──────────────────────────────────────────────
  function onReady(cb) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", cb, { once: true });
    } else {
      cb();
    }
  }

  onReady(function () {
    document.body.classList.add("has-ts-shell");

    var root = document.querySelector(".ts-shell");
    if (!root) return;

    // Populate username + email
    var username = auth.username;
    // The demo's domain, and a straight concatenation of the display name, which
    // for a two-word organisation produced "Sussex Emmaus@demo.twentysix...":
    // a space inside an email address, on the client's own account menu.
    var local = String(username).trim().toLowerCase()
      .replace(/[^a-z0-9._-]+/g, ".").replace(/^\.+|\.+$/g, "");
    var email = auth.email || (local + "@sussexemmaus.org.uk");
    var initials = username.slice(0, 2).toUpperCase();

    var pillName = root.querySelector("[data-ts-shell-username]");
    if (pillName) pillName.textContent = username;
    var pillAvatar = root.querySelector("[data-ts-shell-avatar]");
    if (pillAvatar) pillAvatar.textContent = initials;
    var menuAvatar = root.querySelector("[data-ts-shell-menu-avatar]");
    if (menuAvatar) menuAvatar.textContent = initials;
    var menuName = root.querySelector("[data-ts-shell-menu-name]");
    if (menuName) menuName.textContent = username;
    var menuEmail = root.querySelector("[data-ts-shell-menu-email]");
    if (menuEmail) menuEmail.textContent = email;

    // Tab highlight from current pathname (base-path aware).
    //
    // Only pay and benefits are tested, and that is deliberate: this script is
    // loaded ONLY from those two static surfaces, so the path always matches one
    // of them. Home, Trends, Methodology and Organisation are React pages where
    // Shell.tsx sets its own active tab. Their tabs are rendered here but never
    // matched, which is correct — adding branches for them would be dead code
    // that could only ever fight Shell.tsx.
    var path = window.location.pathname || "/";
    var section = "home";
    if (/\/pay(\/|$)/.test(path)) section = "pay";
    else if (/\/benefits(\/|$)/.test(path)) section = "benefits";

    var tabs = root.querySelectorAll("[data-ts-shell-tab]");
    for (var t = 0; t < tabs.length; t++) {
      var tab = tabs[t];
      if (tab.getAttribute("data-ts-shell-tab") === section) {
        tab.classList.add("ts-shell__tab--active");
      } else {
        tab.classList.remove("ts-shell__tab--active");
      }
    }

    // Dropdown toggle
    var btn = root.querySelector("[data-ts-shell-userbtn]");
    var menu = root.querySelector("[data-ts-shell-menu]");
    if (btn && menu) {
      var setOpen = function (open) {
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        menu.setAttribute("data-open", open ? "true" : "false");
      };

      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var isOpen = btn.getAttribute("aria-expanded") === "true";
        setOpen(!isOpen);
      });

      document.addEventListener("click", function (e) {
        if (!root.contains(e.target)) setOpen(false);
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") setOpen(false);
      });

      var signout = root.querySelector("[data-ts-shell-signout]");
      if (signout) {
        signout.addEventListener("click", function () {
          try { window.localStorage.removeItem(TEMP_AUTH_KEY); } catch (e) {}
          // Clear any Supabase auth tokens too
          try {
            var killKeys = [];
            for (var i = 0; i < window.localStorage.length; i++) {
              var k = window.localStorage.key(i);
              if (k && k.indexOf("sb-") === 0 && k.indexOf("-auth-token") !== -1) {
                killKeys.push(k);
              }
            }
            for (var j = 0; j < killKeys.length; j++) {
              window.localStorage.removeItem(killKeys[j]);
            }
          } catch (e) {}
          window.location.replace(homePath());
        });
      }
    }
  });
})();
