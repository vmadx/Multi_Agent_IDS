const DETECTION_LABELS = {
  http_f: "HTTP Flood",
  icmp_f: "ICMP Flood",
  icmp_smf: "ICMP Smurf",
  none: "Benign",
  smtp_b: "SMTP Spam Bot",
  tcp_land: "LAND Attack",
  tcp_red_w: "Code Red Worm",
  tcp_syn_f: "TCP SYN Flood",
  tcp_udp_win_p: "Scanning / Spread",
  tcp_w32_w: "Blaster Worm",
  udp_0: "UDP Packet Fragmentation",
  udp_f: "UDP Flood",
  udp_reaper_w: "Reaper Worm",
};

export function formatDetectionLabel(label) {
  const rawLabel = String(label ?? "").trim();
  if (!rawLabel) return "Unknown";
  return DETECTION_LABELS[rawLabel.toLowerCase()] || rawLabel;
}

export function formatDetectionLabelText(text, label) {
  const rawLabel = String(label ?? "").trim();
  if (typeof text !== "string" || !rawLabel) return text;
  return text.replaceAll(rawLabel, formatDetectionLabel(rawLabel));
}
