/* Shared unlock gate for the Sussex Emmaus dashboard on GitHub Pages.
 *
 * WHY THIS EXISTS
 * GitHub Pages will not serve a private repo on our plan, so the site has to sit in
 * a public one. The React sign-in is client-side only: on the demo you can curl the
 * bundle and read every salary without logging in. That is fine for a made-up
 * company and unacceptable for a real one, so the parts of the site that carry pay
 * data are shipped as AES-GCM ciphertext and decrypted in the browser.
 *
 * The passphrase is never in the repo. It is the client's own username and password,
 * and it is also what the app's own sign-in expects, so unlocking here signs you in
 * once rather than twice.
 */
(function () {
  var STORE = "sussex-emmaus:unlock";
  var AUTH = "sussex-emmaus:temp-auth";

  function b64(s) {
    var raw = atob(s), a = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) a[i] = raw.charCodeAt(i);
    return a;
  }

  async function keyFrom(secret, salt, iterations) {
    var base = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(secret), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: salt, iterations: iterations, hash: "SHA-256" },
      base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  }

  /* Decrypt one bundle produced by encrypt_site.py. Returns a Uint8Array. */
  async function open(bundle, secret) {
    var key = await keyFrom(secret, b64(bundle.salt), bundle.iterations);
    var out = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64(bundle.iv) }, key, b64(bundle.ct));
    return new Uint8Array(out);
  }

  function text(bytes) {
    return new TextDecoder().decode(bytes);
  }

  window.SEGate = {
    open: open,
    text: text,
    /* The passphrase for this session, if the reader has already unlocked. */
    remembered: function () {
      try { return sessionStorage.getItem(STORE); } catch (e) { return null; }
    },
    remember: function (secret, username) {
      try {
        sessionStorage.setItem(STORE, secret);
        // Unlocking IS signing in. Without this the reader would decrypt the app
        // and then be asked for the same credentials again by the app itself.
        localStorage.setItem(AUTH, JSON.stringify({ username: username }));
      } catch (e) { /* private mode */ }
    },
    forget: function () {
      try {
        sessionStorage.removeItem(STORE);
        localStorage.removeItem(AUTH);
      } catch (e) { /* ignore */ }
    },
    /* Fetch a .enc file and decrypt it. */
    load: async function (url, secret) {
      var res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("could not fetch " + url);
      return open(await res.json(), secret);
    },
  };
})();
