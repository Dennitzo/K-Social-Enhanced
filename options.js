const $ = (id) => document.getElementById(id);
let currentApiKey = "";
let keyVisible = false;
const LOG_EMPTY_MESSAGE = "No entries.";
const DEFAULT_DOMAINS = ["https://k-social.network/*", "http://localhost:5173/*"];
let currentDomains = DEFAULT_DOMAINS.slice();

function setVersionBadge() {
  const badge = $("extVersion");
  if (!badge) return;
  const { version } = chrome.runtime.getManifest();
  badge.textContent = `v${version}`;
}

setVersionBadge();

function coerceDomainList(value, fallback) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    return value.split(/\n+/).map((v) => v.trim()).filter(Boolean);
  }
  return fallback;
}

function normalizePatterns(lines) {
  return lines.map(p => {
    const t = (p || "").trim();
    if (!t) return "";
    if (t.endsWith("*")) return t;
    if (t.endsWith("/")) return t + "*";
    return t;
  }).filter(Boolean);
}

chrome.storage.local.get(
  {
    apiKey: "",
    lang: "DE",
    domains: DEFAULT_DOMAINS,
    notificationsEnabled: false,
    tabTitleEnabled: true,
    bookmarksEnabled: true,
    searchbarEnabled: false,
    debugLogEnabled: false,
    debugLog: []
  },
  (cfg) => {
    currentApiKey = cfg.apiKey || "";
    if (/^\*+$/.test(currentApiKey)) {
      currentApiKey = "";
      setStatus("Please re-enter API key.");
    }
    setKeyVisible(false);
    $("lang").value = cfg.lang;
    currentDomains = normalizePatterns(coerceDomainList(cfg.domains, DEFAULT_DOMAINS));
    $("domains").value = currentDomains.join("\n");
    $("notificationsEnabled").checked = !!cfg.notificationsEnabled;
    $("tabTitleEnabled").checked = cfg.tabTitleEnabled !== false;
    $("bookmarksEnabled").checked = cfg.bookmarksEnabled !== false;
    $("searchbarEnabled").checked = !!cfg.searchbarEnabled;
    $("debugLogEnabled").checked = !!cfg.debugLogEnabled;
    setLogVisibility(!!cfg.debugLogEnabled);
    renderLog(cfg.debugLog || []);
  }
);

function setLogVisibility(enabled) {
  const display = enabled ? "" : "none";
  $("debugLog").style.display = display;
  const logHint = $("debugLogHint");
  if (logHint) logHint.style.display = display;
  $("clearLog").style.display = display;
  const logLabel = $("debugLogLabel");
  if (logLabel) logLabel.style.display = display;
}

function setKeyVisible(visible) {
  keyVisible = visible;
  const apiKeyEl = $("apiKey");
  const toggleBtn = $("toggleKey");
  apiKeyEl.type = "text";
  apiKeyEl.classList.toggle("show", visible);
  if (visible) {
    apiKeyEl.value = currentApiKey;
    toggleBtn.textContent = "Hide key";
  } else {
    apiKeyEl.value = currentApiKey || "";
    apiKeyEl.placeholder = "e.g. xxxx-xxxx-xxxx";
    toggleBtn.textContent = "Show key";
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.debugLog) {
    renderLog(changes.debugLog.newValue || []);
  }
  if (changes.debugLogEnabled) {
    const enabled = !!changes.debugLogEnabled.newValue;
    $("debugLogEnabled").checked = enabled;
    setLogVisibility(enabled);
  }
  if (changes.notificationsEnabled) {
    $("notificationsEnabled").checked = !!changes.notificationsEnabled.newValue;
  }
  if (changes.tabTitleEnabled) {
    $("tabTitleEnabled").checked = changes.tabTitleEnabled.newValue !== false;
  }
  if (changes.bookmarksEnabled) {
    $("bookmarksEnabled").checked = changes.bookmarksEnabled.newValue !== false;
  }
  if (changes.searchbarEnabled) {
    $("searchbarEnabled").checked = !!changes.searchbarEnabled.newValue;
  }
  if (changes.apiKey) {
    currentApiKey = changes.apiKey.newValue || "";
    if (keyVisible) {
      $("apiKey").value = currentApiKey;
    } else {
      setKeyVisible(false);
    }
  }
});

function renderLog(entries) {
  if (!entries || !entries.length) {
    $("debugLog").textContent = LOG_EMPTY_MESSAGE;
    return;
  }

  const lines = entries.map((e) => {
    const ts = e.ts || "";
    const level = (e.level || "info").toUpperCase();
    const msg = e.message || "";
    const details = e.details ? ` | ${e.details}` : "";
    return `${ts} [${level}] ${msg}${details}`;
  });
  $("debugLog").textContent = lines.join("\n");
}

function addDebugLog(level, message, details) {
  chrome.storage.local.get({ debugLogEnabled: false, debugLog: [] }, (stored) => {
    if (!stored.debugLogEnabled) return;
    const entry = {
      ts: new Date().toISOString(),
      level,
      message,
      details
    };
    const next = [entry, ...(stored.debugLog || [])];
    if (next.length > 100) next.length = 100;
    chrome.storage.local.set({ debugLog: next });
  });
}

function setStatus(msg) {
  $("status").textContent = msg;
  setTimeout(() => ($("status").textContent = ""), 2500);
}

function diffDomains(next, prev) {
  const nextSet = new Set(next);
  const prevSet = new Set(prev);
  const added = next.filter((d) => !prevSet.has(d));
  const removed = prev.filter((d) => !nextSet.has(d));
  return { added, removed };
}

function requestOriginPermissions(origins) {
  return new Promise((resolve) => {
    if (!origins.length) {
      resolve(true);
      return;
    }
    chrome.permissions.request({ origins }, (granted) => resolve(!!granted));
  });
}

function removeOriginPermissions(origins) {
  return new Promise((resolve) => {
    if (!origins.length) {
      resolve(true);
      return;
    }
    chrome.permissions.remove({ origins }, () => resolve(true));
  });
}

$("save").onclick = async () => {
  const domains = normalizePatterns($("domains").value.split(/\n+/));
  let apiKeyValue = $("apiKey").value.trim();
  const { added, removed } = diffDomains(domains, currentDomains);
  const granted = await requestOriginPermissions(domains);
  if (!granted && domains.length) {
    setStatus("Permission denied for new domains.");
    addDebugLog("warn", "Domain permission request denied");
  }
  await removeOriginPermissions(removed);

  const basePayload = {
    lang: $("lang").value,
    domains,
    notificationsEnabled: $("notificationsEnabled").checked,
    tabTitleEnabled: $("tabTitleEnabled").checked,
    bookmarksEnabled: $("bookmarksEnabled").checked,
    searchbarEnabled: $("searchbarEnabled").checked,
    debugLogEnabled: $("debugLogEnabled").checked
  };

  if (!keyVisible && /^\*+$/.test(apiKeyValue)) {
    apiKeyValue = "";
  }

  if (apiKeyValue) {
    currentApiKey = apiKeyValue;
  } else {
    currentApiKey = "";
  }

  chrome.storage.local.set(
    {
      ...basePayload,
      apiKey: currentApiKey
    },
    () => {
      setStatus("Saved ✔ (tabs load new settings on next reload)");
      addDebugLog("info", "Settings saved");
      if (apiKeyValue) {
        addDebugLog("info", "API key updated");
      }
      setKeyVisible(false);
      currentDomains = domains;
      chrome.runtime.sendMessage({ type: "updateContentScripts", domains });
    }
  );
};

$("toggleKey").onclick = () => {
  if (!keyVisible) {
    const draft = $("apiKey").value.trim();
    if (draft && !/^\*+$/.test(draft)) {
      currentApiKey = draft;
    }
  }
  setKeyVisible(!keyVisible);
};

$("clearLog").onclick = () => {
  chrome.storage.local.set({ debugLog: [] }, () => {
    renderLog([]);
    setStatus("Log cleared ✔");
  });
};

$("clearCache").onclick = () => {
  chrome.storage.local.clear(() => {
    currentApiKey = "";
    setKeyVisible(false);
    setStatus("Cache cleared ✔");
    location.reload();
  });
};
