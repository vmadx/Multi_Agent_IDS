"""
Adapt & Escalate Agent (Phani - Agent 5)
Triggers when closed-loop verification reports that a threat persists.
Implements an escalation ladder to adapt defensive rules (Subnet Ban, Port Throttling,
Emergency Quarantine) or escalates to Tier-2 human analysts when autonomous limits are reached.
"""

from typing import Dict, Any, List
from src.schemas import (
    EscalationDecision,
    EscalationLevel,
    ResponseAction,
    ActionType,
    AgentState
)
from src.utils import agent_log

class AdaptEscalateAgent:
    MAX_AUTONOMOUS_ESCALATIONS = 2

    def determine_escalation(
        self,
        target_ip: str,
        escalation_count: int,
        plan_id: str
    ) -> EscalationDecision:
        """Applies escalation policy based on current attempt counter."""
        adapted_actions: List[ResponseAction] = []
        requires_tier2 = False

        if escalation_count == 1:
            # Level 1 Escalation: Upgrade single IP ban to entire /24 Subnet Ban
            subnet = target_ip.rsplit(".", 1)[0] + ".0/24"
            escalation_level = EscalationLevel.SUBNET_BAN
            reason = f"Threat persisted after single IP block on {target_ip}. Escalating to /24 Subnet Ban on [{subnet}]."
            
            adapted_actions.append(ResponseAction(
                action_type=ActionType.BLOCK_IP,
                target=subnet,
                priority=1,
                parameters={"scope": "SUBNET_BAN", "duration_sec": 7200}
            ))

        elif escalation_count == 2:
            # Level 2 Escalation: Attack is evading subnet ban -> Quarantine target internal server & throttle
            escalation_level = EscalationLevel.EMERGENCY_QUARANTINE
            reason = f"Attack evading subnet ban. Triggering Host Quarantine & port throttling to isolate asset."
            
            adapted_actions.append(ResponseAction(
                action_type=ActionType.ISOLATE_HOST,
                target=target_ip,
                priority=1
            ))
            adapted_actions.append(ResponseAction(
                action_type=ActionType.RATE_LIMIT,
                target="0.0.0.0/0",
                priority=2,
                parameters={"rate_kbps": 100}
            ))

        else:
            # Level 3 Escalation: Exceeded autonomous threshold -> Halt loop & summon Tier-2 Analyst
            escalation_level = EscalationLevel.TIER2_NOTIFY
            requires_tier2 = True
            reason = f"Max autonomous mitigation limit ({self.MAX_AUTONOMOUS_ESCALATIONS}) reached. Handing over to human Tier-2 SOC Analyst."
            
            adapted_actions.append(ResponseAction(
                action_type=ActionType.ALERT_ANALYST,
                target=f"INCIDENT_HOTLINE_{target_ip}",
                priority=1,
                parameters={"severity": "CRITICAL", "action_required": "MANUAL_INVESTIGATION"}
            ))

        return EscalationDecision(
            plan_id=plan_id,
            target_ip=target_ip,
            escalation_level=escalation_level,
            adapted_actions=adapted_actions,
            escalation_count=escalation_count,
            reason=reason,
            requires_tier2_human=requires_tier2
        )

    def process(self, state: AgentState) -> AgentState:
        """
        LangGraph Node function interface.
        Reads verification failure, computes adapted countermeasures, and prepares state for next loop.
        """
        verif_dict = state.get("verification_result") or {}
        threat_cleared = verif_dict.get("threat_cleared", True)

        if threat_cleared:
            agent_log("ESCALATION", "Verification confirmed threat is cleared. No escalation needed.")
            state["status"] = "RESOLVED"
            return state

        target_ip = verif_dict.get("target_ip", "0.0.0.0")
        plan_id = verif_dict.get("plan_id", "PLAN_0")
        current_count = state.get("escalation_count", 0) + 1

        decision = self.determine_escalation(
            target_ip=target_ip,
            escalation_count=current_count,
            plan_id=plan_id
        )

        state["escalation_decision"] = decision.model_dump()
        state["escalation_count"] = current_count
        state["status"] = "ESCALATED"

        # Update response_plan with adapted actions so Execution Agent can re-execute in the loop
        if decision.adapted_actions:
            current_plan = state.get("response_plan") or {"plan_id": plan_id}
            current_plan["actions"] = [a.model_dump() for a in decision.adapted_actions]
            state["response_plan"] = current_plan

        audit = state.get("audit_logs", [])
        audit.append(f"AdaptEscalateAgent: Level {decision.escalation_level.value} triggered (Attempt #{current_count})")
        state["audit_logs"] = audit

        agent_log("ESCALATION", f"Escalation Triggered: [{decision.escalation_level.value}] for [{target_ip}] | Attempt #{current_count} | Reason: {decision.reason}")
        return state
