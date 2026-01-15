const statusEl = document.getElementById("status");
const listEl = document.getElementById("domainList");
const grantBtn = document.getElementById("grant");

function setStatus(msg) {
  statusEl.textContent = msg;
}

function parseDomains() {
  const params = new URLSearchParams(location.search);
  const raw = params.get("domains") || "[]";
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

const domains = parseDomains();
listEl.textContent = domains.length ? domains.join("\n") : "No domains provided.";

grantBtn.onclick = () => {
  if (!domains.length) {
    setStatus("Nothing to grant.");
    return;
  }
  chrome.permissions.request({ origins: domains }, (granted) => {
    if (!granted) {
      setStatus("Access denied.");
      return;
    }
    chrome.runtime.sendMessage({ type: "permissionsGranted", domains }, () => {
      setStatus("Access granted. You can close this tab.");
      setTimeout(() => window.close(), 1200);
    });
  });
};
