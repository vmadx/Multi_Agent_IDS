"""
Firewall Simulation Driver
Provides a safe, sandboxed network control plane driver for executing countermeasures.
Tracks active blocked IPs, CIDR bans, rate-limited streams, and quarantined hosts.
"""

from datetime import datetime, timezone
from typing import Dict, List, Set, Any
from src.utils import agent_log

class FirewallDriver:
    _instance = None

    def __new__(cls, *args, **kwargs):
        # Singleton pattern so all agents share the same firewall state in memory
        if not cls._instance:
            cls._instance = super(FirewallDriver, cls).__new__(cls)
            cls._instance._init_state()
        return cls._instance

    def _init_state(self):
        self.blocked_ips: Set[str] = set()
        self.blocked_subnets: Set[str] = set()
        self.quarantined_hosts: Set[str] = set()
        self.rate_limited_targets: Dict[str, int] = {}  # ip -> rate_kbps
        self.active_rules: List[Dict[str, Any]] = []

    def block_ip(self, ip: str, duration_sec: int = 3600) -> bool:
        """Blocks all inbound and outbound traffic for a specific IP."""
        if "/" in ip:
            # Subnet CIDR
            self.blocked_subnets.add(ip)
            rule_type = "SUBNET_BAN"
        else:
            self.blocked_ips.add(ip)
            rule_type = "IP_BLOCK"

        rule = {
            "type": rule_type,
            "target": ip,
            "duration_sec": duration_sec,
            "applied_at": datetime.now(timezone.utc).isoformat()
        }
        self.active_rules.append(rule)
        agent_log("EXECUTION", f"Firewall Rule Applied: {rule_type} on target [{ip}] (Expires in {duration_sec}s)")
        return True

    def rate_limit(self, target: str, rate_kbps: int = 500) -> bool:
        """Throttles bandwidth for a given target IP or port."""
        self.rate_limited_targets[target] = rate_kbps
        rule = {
            "type": "RATE_LIMIT",
            "target": target,
            "rate_kbps": rate_kbps,
            "applied_at": datetime.now(timezone.utc).isoformat()
        }
        self.active_rules.append(rule)
        agent_log("EXECUTION", f"Traffic Throttling Applied: RATE_LIMIT [{target}] at {rate_kbps} kbps")
        return True

    def isolate_host(self, host_ip: str) -> bool:
        """Quarantines an internal compromised asset from the local subnet."""
        self.quarantined_hosts.add(host_ip)
        rule = {
            "type": "EMERGENCY_QUARANTINE",
            "target": host_ip,
            "applied_at": datetime.now(timezone.utc).isoformat()
        }
        self.active_rules.append(rule)
        agent_log("EXECUTION", f"Emergency Isolation Applied: HOST_QUARANTINE on [{host_ip}] (VLAN Isolated)")
        return True

    def drop_session(self, session_id: str) -> bool:
        """Sends TCP RST to immediately drop an active connection session."""
        rule = {
            "type": "DROP_SESSION",
            "target": session_id,
            "applied_at": datetime.now(timezone.utc).isoformat()
        }
        self.active_rules.append(rule)
        agent_log("EXECUTION", f"Session Terminated: TCP RST sent to session [{session_id}]")
        return True

    def is_blocked(self, ip: str) -> bool:
        """Checks if an IP or its parent subnet is currently blocked."""
        if ip in self.blocked_ips:
            return True
        for subnet in self.blocked_subnets:
            # Simple /24 prefix match (e.g. '192.168.1.0/24' matches '192.168.1.*')
            prefix = subnet.split("/")[0].rsplit(".", 1)[0]
            if ip.startswith(prefix):
                return True
        return False

    def reset_rules(self):
        """Clears all active rules (useful for test isolation)."""
        self._init_state()
