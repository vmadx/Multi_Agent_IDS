import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.schemas import (
    NetworkEvent,
    TriagedAlert,
    SeverityLevel,
    ActionType,
    ResponseAction,
    ResponsePlan,
    ExecutionResult,
    ExecutionStatus,
    VerificationResult,
    EscalationDecision,
    EscalationLevel,
    AgentState
)
from src.utils import agent_log

def test_phase1_schemas():
    agent_log("PIPELINE", "Starting Phase 1 Schema Validation...")

    # 1. Test NetworkEvent
    event = NetworkEvent(
        src_ip="192.168.1.105",
        dst_ip="10.0.0.1",
        src_port=44820,
        dst_port=80,
        protocol="TCP",
        duration=0.45,
        packet_count=120,
        byte_count=15420,
        flags="SYN"
    )
    assert event.src_ip == "192.168.1.105"
    assert event.event_id is not None
    agent_log("MONITORING", f"NetworkEvent validated. ID={event.event_id[:8]}... src={event.src_ip}:{event.src_port}")

    # 2. Test TriagedAlert
    alert = TriagedAlert(
        event_id=event.event_id,
        src_ip=event.src_ip,
        dst_ip=event.dst_ip,
        dst_port=event.dst_port,
        urgency_score=0.88,
        severity=SeverityLevel.CRITICAL,
        category="SYN Flood / DDoS",
        reason="Abnormal SYN packet frequency detected from single host"
    )
    assert alert.severity == SeverityLevel.CRITICAL
    agent_log("TRIAGE", f"TriagedAlert validated. Severity={alert.severity.value}, Score={alert.urgency_score}")

    # 3. Test ResponseAction & ResponsePlan
    action1 = ResponseAction(
        action_type=ActionType.BLOCK_IP,
        target="192.168.1.105",
        priority=1,
        parameters={"duration_sec": 3600}
    )
    plan = ResponsePlan(
        alert_id=alert.alert_id,
        actions=[action1],
        approved_by="ANALYST_SAIPHANI"
    )
    assert len(plan.actions) == 1
    agent_log("EXECUTION", f"ResponsePlan validated. PlanID={plan.plan_id[:8]}... Action={plan.actions[0].action_type.value}")

    # 4. Test ExecutionResult
    exec_res = ExecutionResult(
        action_id=action1.action_id,
        action_type=action1.action_type,
        target=action1.target,
        status=ExecutionStatus.SUCCESS
    )
    assert exec_res.status == ExecutionStatus.SUCCESS

    # 5. Test VerificationResult
    verif = VerificationResult(
        plan_id=plan.plan_id,
        target_ip=action1.target,
        threat_cleared=False,
        confidence=0.4,
        post_action_packet_rate=85.0,
        observed_drop_percentage=29.1,
        details="Attacker migrated to neighboring IP within same subnet"
    )
    assert verif.threat_cleared is False
    agent_log("VERIFICATION", f"VerificationResult validated. Cleared={verif.threat_cleared}, Confidence={verif.confidence}")

    # 6. Test EscalationDecision
    adapted_action = ResponseAction(
        action_type=ActionType.BLOCK_IP,
        target="192.168.1.0/24",
        priority=1,
        parameters={"scope": "SUBNET_BAN"}
    )
    escalation = EscalationDecision(
        plan_id=plan.plan_id,
        target_ip=action1.target,
        escalation_level=EscalationLevel.SUBNET_BAN,
        adapted_actions=[adapted_action],
        escalation_count=1,
        reason="Attacker rotating source IPs inside subnet. Upgraded to /24 ban."
    )
    assert escalation.escalation_level == EscalationLevel.SUBNET_BAN
    agent_log("ESCALATION", f"EscalationDecision validated. Level={escalation.escalation_level.value}")

    # 7. Test LangGraph AgentState dictionary compatibility
    state: AgentState = {
        "current_event": event.model_dump(),
        "current_alert": alert.model_dump(),
        "response_plan": plan.model_dump(),
        "execution_results": [exec_res.model_dump()],
        "verification_result": verif.model_dump(),
        "escalation_decision": escalation.model_dump(),
        "escalation_count": 1,
        "status": "ESCALATED",
        "audit_logs": ["Event ingested", "Alert triaged", "Plan executed", "Verification failed", "Escalated to /24"]
    }
    assert state["status"] == "ESCALATED"
    assert len(state["audit_logs"]) == 5
    agent_log("PIPELINE", f"AgentState LangGraph dictionary validated with {len(state)} keys.")

    print("\n>>> ALL PHASE 1 SCHEMAS PASSED SUCCESSFULLY! <<<")

if __name__ == "__main__":
    test_phase1_schemas()
