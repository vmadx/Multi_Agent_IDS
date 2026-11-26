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
  summary: () => request("/api/v1/summary"),
  alerts: (filters = {}) => {
    const params = new URLSearchParams(
      Object.entries(filters).filter(([, value]) => value !== undefined && value !== null && value !== ""),
    );
    const query = params.toString();
    return request(`/api/v1/alerts${query ? `?${query}` : ""}`);
  },
  incidents: () => request("/api/v1/incidents"),
  assistantQuery: async (question, onEvent) => {
    const response = await fetch(`${BASE_URL}/api/v1/assistant/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => null);
      throw new Error(detail?.detail || `API request failed (${response.status})`);
    }
    if (!response.body) {
      throw new Error("The assistant response does not support streaming.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let completed = false;
    const dispatchFrame = (frame) => {
      const data = frame
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      if (!data) return;
      let event;
      try {
        event = JSON.parse(data);
      } catch {
        throw new Error("The assistant returned an invalid streaming event.");
      }
      if (event.type === "error") {
        throw new Error(event.message || "The assistant could not generate a response.");
      }
      if (event.type === "done") completed = true;
      onEvent?.(event);
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const frames = buffer.split(/\r?\n\r?\n/);
        buffer = frames.pop() || "";
        frames.forEach(dispatchFrame);
        if (done) break;
      }
      if (buffer.trim()) dispatchFrame(buffer);
    } finally {
      reader.releaseLock();
    }
    if (!completed) {
      throw new Error("The assistant response ended before generation completed.");
    }
  },
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
