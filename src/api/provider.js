const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.detail || `API request failed (${response.status})`);
  }
  return response.json();
}

export const nidsApi = {
  health: () => request("/api/v1/health"),
  incident: (incidentId) =>
    request(`/api/v1/incidents/${encodeURIComponent(incidentId)}`),
  workflow: (incidentId) =>
    request(`/api/v1/incidents/${encodeURIComponent(incidentId)}/workflow`),
  decide: (incidentId, payload) =>
    request(`/api/v1/incidents/${encodeURIComponent(incidentId)}/decision`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createAlert: (alert) =>
    request("/api/v1/alerts", {
      method: "POST",
      body: JSON.stringify(alert),
    }),
  replan: (incidentId, prompt) =>
    request(`/api/v1/incidents/${encodeURIComponent(incidentId)}/replan`, {
      method: "POST",
      body: JSON.stringify({ prompt }),
    }),
  upload: (file, onProgress) =>
    new Promise((resolve, reject) => {
      const form = new FormData();
      form.append("file", file);
      const request = new XMLHttpRequest();
      request.open("POST", `${BASE_URL}/api/v1/uploads/analyze`);
      request.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable && onProgress) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      });
      request.addEventListener("load", () => {
        let payload;
        try {
          payload = JSON.parse(request.responseText);
        } catch {
          reject(new Error("The scan service returned an invalid response"));
          return;
        }
        if (request.status < 200 || request.status >= 300) {
          reject(new Error(payload?.detail || `Upload failed (${request.status})`));
          return;
        }
        resolve(payload);
      });
      request.addEventListener("error", () => reject(new Error("Upload failed: network error")));
      request.send(form);
    }),
  uploadStatus: (jobId) =>
    request(`/api/v1/uploads/${encodeURIComponent(jobId)}`),
};
