"""
Verification Agent (Phani - Agent 4)
Performs closed-loop verification to confirm whether executed countermeasures
successfully neutralized the threat or if the attack persists/migrated.
"""

from typing import Optional, Dict, Any, List
from src.schemas import VerificationResult, AgentState
from src.simulation.firewall_driver import FirewallDriver
from src.utils import agent_log

class VerificationAgent:
    def __init__(self, firewall: Optional[FirewallDriver] = None):
        self.firewall = firewall or FirewallDriver()

    def verify_mitigation(
        self,
        plan_id: str,
        target_ip: str,
        pre_action_rate: float = 100.0,
        post_traffic_samples: Optional[List[Dict[str, Any]]] = None
    ) -> VerificationResult:
        """
        Samples post-action telemetry to verify whether malicious traffic dropped.
        """
        is_blocked = self.firewall.is_blocked(target_ip)

        # In simulation mode, evaluate post_traffic_samples if provided
        if post_traffic_samples:
            # Count packets still arriving from target_ip
            residual_packets = sum(
                s.get("packet_count", 0) for s in post_traffic_samples if s.get("src_ip") == target_ip
            )
            observed_drop = max(0.0, min(100.0, ((pre_action_rate - residual_packets) / max(pre_action_rate, 1)) * 100.0))
            threat_cleared = residual_packets == 0 and is_blocked
            confidence = round(observed_drop / 100.0, 2)
            post_rate = float(residual_packets)
            details = (
                f"Post-action verification: Packet rate dropped by {observed_drop:.1f}%. "
                f"Residual packet count = {residual_packets}."
            )
        else:
            # Standard verification via firewall status check
            if is_blocked:
                threat_cleared = True
                confidence = 0.95
                post_rate = 0.0
                observed_drop = 100.0
                details = f"Active firewall block confirmed on target [{target_ip}]. Inbound flows zeroed."
            else:
                threat_cleared = False
                confidence = 0.20
                post_rate = pre_action_rate
                observed_drop = 0.0
                details = f"No active block rule verified on target [{target_ip}]. Threat still active."

        return VerificationResult(
            plan_id=plan_id,
            target_ip=target_ip,
            threat_cleared=threat_cleared,
            confidence=confidence,
            post_action_packet_rate=post_rate,
            observed_drop_percentage=observed_drop,
            details=details
        )

    def process(self, state: AgentState) -> AgentState:
        """
        LangGraph Node function interface.
        Evaluates post-execution state and updates state['verification_result'].
        """
        plan_dict = state.get("response_plan") or {}
        alert_dict = state.get("current_alert") or {}
        event_dict = state.get("current_event") or {}

        plan_id = plan_dict.get("plan_id", "UNKNOWN_PLAN")
        target_ip = alert_dict.get("src_ip") or event_dict.get("src_ip", "0.0.0.0")
        pre_rate = float(event_dict.get("packet_count", 100))

        # Check if caller passed a simulated evasion in state for testing
        simulated_post_samples = state.get("test_post_action_samples")

        verif_result = self.verify_mitigation(
            plan_id=plan_id,
            target_ip=target_ip,
            pre_action_rate=pre_rate,
            post_traffic_samples=simulated_post_samples
        )

        state["verification_result"] = verif_result.model_dump()
        state["status"] = "VERIFIED"

        status_str = "CLEARED" if verif_result.threat_cleared else "PERSISTS"
        audit = state.get("audit_logs", [])
        audit.append(f"VerificationAgent: Threat {status_str} (Confidence: {verif_result.confidence}, Drop: {verif_result.observed_drop_percentage:.1f}%)")
        state["audit_logs"] = audit

        agent_log("VERIFICATION", f"Verification complete for [{target_ip}]: Threat {status_str} | Confidence: {verif_result.confidence} | Drop: {verif_result.observed_drop_percentage:.1f}%")
        return state
