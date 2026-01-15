chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

const CONTENT_SCRIPT_ID = "ks-content-script";
const DEFAULT_DOMAINS = ["https://k-social.network/*"];

function normalizePatterns(lines) {
  return lines.map((p) => {
    const t = (p || "").trim();
    if (!t) return "";
    if (t.endsWith("*")) return t;
    if (t.endsWith("/")) return t + "*";
    return t;
  }).filter(Boolean);
}

function coerceDomainList(value, fallback) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    return value.split(/\n+/).map((v) => v.trim()).filter(Boolean);
  }
  return fallback;
}

function getStoredDomains() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ domains: DEFAULT_DOMAINS }, (cfg) => {
      resolve(coerceDomainList(cfg.domains, DEFAULT_DOMAINS));
    });
  });
}

function filterPermittedDomains(domains) {
  return Promise.all(
    domains.map((origin) => new Promise((resolve) => {
      chrome.permissions.contains({ origins: [origin] }, (hasPermission) => {
        resolve(hasPermission ? origin : null);
      });
    }))
  ).then((results) => results.filter(Boolean));
}

function findMissingPermissions(domains) {
  return Promise.all(
    domains.map((origin) => new Promise((resolve) => {
      chrome.permissions.contains({ origins: [origin] }, (hasPermission) => {
        resolve(hasPermission ? null : origin);
      });
    }))
  ).then((results) => results.filter(Boolean));
}

function removeOriginPermissions(origins) {
  return new Promise((resolve) => {
    if (!origins || !origins.length) {
      resolve();
      return;
    }
    chrome.permissions.remove({ origins }, () => resolve());
  });
}

function registerContentScripts(domains) {
  const patterns = normalizePatterns(domains);
  return filterPermittedDomains(patterns).then((allowed) => new Promise((resolve) => {
    chrome.scripting.unregisterContentScripts({ ids: [CONTENT_SCRIPT_ID] }, () => {
      if (chrome.runtime.lastError) {
        // Ignore missing registration errors.
      }
      if (!allowed.length) {
        resolve();
        return;
      }
      chrome.scripting.registerContentScripts([{
        id: CONTENT_SCRIPT_ID,
        matches: allowed,
        js: ["content.js"],
        runAt: "document_idle"
      }], () => resolve());
    });
  }));
}

function refreshContentScripts() {
  getStoredDomains().then((domains) => registerContentScripts(domains));
}

chrome.runtime.onInstalled.addListener(() => {
  refreshContentScripts();
});

chrome.runtime.onStartup.addListener(() => {
  refreshContentScripts();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.domains) {
    refreshContentScripts();
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "notify") {
    chrome.notifications.create({
      type: "basic",
      iconUrl: chrome.runtime.getURL("icon.png"),
      title: "K-Social Enhanced",
      message: msg.text
    });
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "checkMissingPermissions") {
    const domains = Array.isArray(msg.domains) ? msg.domains : DEFAULT_DOMAINS;
    findMissingPermissions(normalizePatterns(domains)).then((missing) => {
      sendResponse({ ok: true, missing });
    });
    return true;
  }
  if (msg && msg.type === "openPermissions") {
    const domains = Array.isArray(msg.domains) ? msg.domains : DEFAULT_DOMAINS;
    const removed = Array.isArray(msg.removed) ? msg.removed : [];
    removeOriginPermissions(normalizePatterns(removed)).then(() => {
      const url = new URL(chrome.runtime.getURL("permissions.html"));
      url.searchParams.set("domains", JSON.stringify(normalizePatterns(domains)));
      chrome.tabs.create({ url: url.toString() });
      sendResponse({ ok: true });
    });
    return true;
  }
  if (msg && msg.type === "permissionsGranted") {
    const domains = Array.isArray(msg.domains) ? msg.domains : DEFAULT_DOMAINS;
    registerContentScripts(domains).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg && msg.type === "syncPermissions") {
    const domains = Array.isArray(msg.domains) ? msg.domains : DEFAULT_DOMAINS;
    const removed = Array.isArray(msg.removed) ? msg.removed : [];
    const patterns = normalizePatterns(domains);
    if (!patterns.length) {
      removeOriginPermissions(normalizePatterns(removed)).then(() => {
        sendResponse({ ok: true, granted: true, requested: [] });
      });
      return true;
    }
    chrome.permissions.request({ origins: patterns }, (granted) => {
      removeOriginPermissions(normalizePatterns(removed)).then(() => {
        registerContentScripts(patterns).then(() => {
          sendResponse({ ok: true, granted: !!granted, requested: patterns });
        });
      });
    });
    return true;
  }
  if (msg && msg.type === "updateContentScripts") {
    const domains = Array.isArray(msg.domains) ? msg.domains : DEFAULT_DOMAINS;
    registerContentScripts(domains).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (!msg || msg.type !== "translate") return;

  (async () => {
    try {
      const res = await fetch("https://api-free.deepl.com/v2/translate", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          auth_key: msg.apiKey,
          text: msg.text,
          target_lang: msg.lang
        }).toString()
      });

      const bodyText = await res.text();
      let json;
      try {
        json = JSON.parse(bodyText);
      } catch (parseErr) {
        throw new Error(`DeepL Antwort ist kein JSON (HTTP ${res.status}).`);
      }

      if (!res.ok) {
        const apiMessage = (json && json.message) ? json.message : bodyText.slice(0, 200);
        throw new Error(`DeepL error (HTTP ${res.status}): ${apiMessage}`);
      }

      if (!json || !json.translations || !json.translations[0]) {
        throw new Error("DeepL response is invalid.");
      }

      sendResponse({ ok: true, text: json.translations[0].text });
    } catch (err) {
      const errMsg = err && err.message ? err.message : String(err);
      sendResponse({ ok: false, error: errMsg });
    }
  })();

  return true;
});
