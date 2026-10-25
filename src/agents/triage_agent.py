"""
Triage Agent (Phani - Agent 2)
Acts as the first-line intelligent filter in the SOC pipeline:
- Deduplicates repetitive connection bursts (sliding window).
- Applies IP Whitelist/Blacklist checks.
- Computes weighted urgency scores (0.0 to 1.0).
- Categorizes threat heuristics (DDoS, Port Scan, Brute-Force, Benign).
- Generates TriagedAlert models and determines if deep ML/LLM investigation is needed.
"""

from datetime import datetime, timezone
from typing import Dict, Tuple, Optional, Set
from src.schemas import TriagedAlert, SeverityLevel, AgentState
from src.utils import agent_log

class TriageAgent:
    # High-risk ports frequently targeted by adversaries
    SENSITIVE_PORTS = {
        21: ("FTP", 0.7),
        22: ("SSH", 0.8),
        23: ("Telnet", 0.9),
        25: ("SMTP", 0.5),
        445: ("SMB", 0.85),
        3389: ("RDP", 0.85),
        1433: ("MSSQL", 0.75),
        3306: ("MySQL", 0.75)
    }

    def __init__(self, dedup_window_sec: int = 300):
        self.dedup_window_sec = dedup_window_sec
        # Cache key: (src_ip, dst_ip, dst_port) -> last_seen_epoch
        self._dedup_cache: Dict[Tuple[str, str, int], float] = {}
        
        # Port scan detection tracker: src_ip -> set of distinct probed ports
        self._port_scan_tracker: Dict[str, Set[int]] = {}

        # Default Whitelist (Trusted Infrastructure)
        self.whitelist_ips: Set[str] = {
            "127.0.0.1",
            "192.168.1.1",       # Default Gateway
            "8.8.8.8",           # Google DNS
            "1.1.1.1"            # Cloudflare DNS
        }

        # Default Threat Intel Blacklist (Known Bad Actors)
        self.blacklist_ips: Set[str] = {
            "198.51.100.14",     # Simulated C2 Server
            "203.0.113.88"       # Known Botnet Node
        }

    def _is_duplicate(self, src_ip: str, dst_ip: str, dst_port: int, now_epoch: float) -> bool:
        """Checks if an identical connection tuple was observed within the sliding window."""
        key = (src_ip, dst_ip, dst_port)
        last_seen = self._dedup_cache.get(key)
        self._dedup_cache[key] = now_epoch

        if last_seen and (now_epoch - last_seen) < self.dedup_window_sec:
            return True
        return False

    def compute_urgency(self, event_data: Dict) -> Tuple[float, SeverityLevel, str, str]:
        """
        Computes urgency score (0.0 - 1.0), severity level, category, and explanation.
        """
        src_ip = event_data.get("src_ip", "")
        dst_port = event_data.get("dst_port", 0)
        packet_count = event_data.get("packet_count", 1)
        duration = event_data.get("duration", 0.0)
        flags = str(event_data.get("flags", "")).upper()

        # 1. Whitelist Check
        if src_ip in self.whitelist_ips:
            return 0.0, SeverityLevel.BENIGN, "Benign (Whitelisted)", "Source IP is explicitly whitelisted"

        # 2. Blacklist Check
        if src_ip in self.blacklist_ips:
            return 1.0, SeverityLevel.CRITICAL, "Known Threat Actor", "Source IP matches active threat intelligence blacklist"

        # 3. Port Scan Tracking
        probed_ports = self._port_scan_tracker.setdefault(src_ip, set())
        probed_ports.add(dst_port)
        if len(probed_ports) >= 4:
            return 0.75, SeverityLevel.HIGH, "Port Scan", f"Sequential port scanning detected ({len(probed_ports)} distinct ports probed)"

        # 4. High Packet Volume / Flood Indicator (DDoS / SYN Flood)
        # Low duration (< 0.1s) and high packet count (> 100) or pure SYN flags
        if (packet_count > 100 and duration < 0.2) or (packet_count > 300 and "SYN" in flags):
            return 0.92, SeverityLevel.CRITICAL, "SYN Flood / DDoS", f"Massive packet surge ({packet_count} packets in {duration:.2f}s)"

        # 5. Targeted Sensitive Port Access (Brute-Force)
        if dst_port in self.SENSITIVE_PORTS:
            service_name, port_risk = self.SENSITIVE_PORTS[dst_port]
            if packet_count > 30:
                return port_risk + 0.1, SeverityLevel.HIGH, f"{service_name} Brute-Force", f"High traffic to sensitive service {service_name} (Port {dst_port})"
            return port_risk, SeverityLevel.MEDIUM, f"Suspicious {service_name} Probe", f"Access attempt to sensitive port {dst_port}"

        # 6. Standard Web Traffic Baseline
        if dst_port in (80, 443) and packet_count < 50:
            return 0.15, SeverityLevel.LOW, "Benign Web Traffic", "Normal HTTP/HTTPS traffic volume"

        # 7. Default Suspicious Anomaly
        return 0.45, SeverityLevel.MEDIUM, "Unclassified Flow", "Flow characteristics require ML classification"

    def process(self, state: AgentState) -> AgentState:
        """
        LangGraph Node function interface.
        Reads state['current_event'], applies triage filtering, and generates state['current_alert'].
        """
        event_dict = state.get("current_event")
        if not event_dict:
            agent_log("TRIAGE", "No event found in state to triage.")
            state["current_alert"] = None
            return state

        src_ip = event_dict.get("src_ip", "")
        dst_ip = event_dict.get("dst_ip", "")
        dst_port = event_dict.get("dst_port", 0)
        event_id = event_dict.get("event_id", "")
        now_epoch = datetime.now(timezone.utc).timestamp()

        # Check deduplication
        is_dup = self._is_duplicate(src_ip, dst_ip, dst_port, now_epoch)

        # Compute Urgency & Severity
        urgency_score, severity, category, reason = self.compute_urgency(event_dict)

        alert = TriagedAlert(
            event_id=event_id,
            src_ip=src_ip,
            dst_ip=dst_ip,
            dst_port=dst_port,
            urgency_score=urgency_score,
            severity=severity,
            category=category,
            is_duplicate=is_dup,
            reason=reason
        )

        state["current_alert"] = alert.model_dump()
        state["status"] = "TRIAGED"
        
        audit = state.get("audit_logs", [])
        audit.append(f"TriageAgent: Classified as {severity.value} ({category}, Score={urgency_score:.2f})")
        state["audit_logs"] = audit

        agent_log("TRIAGE", f"Alert Triaged: {severity.value} | {category} | Score: {urgency_score:.2f} | Target: {src_ip} -> {dst_ip}:{dst_port}")
        return state
