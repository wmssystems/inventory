async function apiGet(action, params = {}) {
  if (!WMS_CONFIG.API_URL || WMS_CONFIG.API_URL === "PASTE_WEB_APP_URL_HERE") {
    throw new Error("API_URL belum diisi di js/config.js");
  }

  const url = new URL(WMS_CONFIG.API_URL);
  url.searchParams.set("action", action);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  });

  const response = await fetch(url.toString(), { method: "GET" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function apiPost(action, data = {}) {
  if (!WMS_CONFIG.API_URL || WMS_CONFIG.API_URL === "PASTE_WEB_APP_URL_HERE") {
    throw new Error("API_URL belum diisi di js/config.js");
  }

  const response = await fetch(WMS_CONFIG.API_URL, {
    method: "POST",
    headers: {"Content-Type": "text/plain;charset=utf-8"},
    body: JSON.stringify({ action, ...data })
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
