"""
Comprehensive Pipeline Test for Phani's 5 Agents:
1. Monitoring Agent
2. Triage Agent
3. Response Execution Agent
4. Verification Agent
5. Adapt & Escalate Agent
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.agents import (
    MonitoringAgent,
    TriageAgent,
    ResponseExecutionAgent,
    VerificationAgent,
    AdaptEscalateAgent
)
from src.schemas import (
    ResponsePlan,
    ResponseAction,
    ActionType,
    EscalationLevel,
    AgentState
)
from src.simulation.firewall_driver import FirewallDriver
from src.utils import agent_log

def test_scenario_1_happy_path():
    agent_log("PIPELINE", "\n=======================================================")
    agent_log("PIPELINE", "TEST 1: Happy Path (Ingest -> Triage -> Execute -> Verified Cleared)")
    agent_log("PIPELINE", "=======================================================")

    firewall = FirewallDriver()
    firewall.reset_rules()

    monitor = MonitoringAgent()
    triage = TriageAgent()
    executor = ResponseExecutionAgent(firewall=firewall)
    verifier = VerificationAgent(firewall=firewall)

    state: AgentState = {"audit_logs": []}

    # 1. Monitoring Ingestion
    raw_event = {
        "src_ip": "198.51.100.55",
        "dst_ip": "10.0.0.1",
        "src_port": 54321,
        "dst_port": 80,
        "protocol": "TCP",
        "duration": 0.05,
        "packet_count": 600,
        "byte_count": 24000,
        "flags": "SYN"
    }
    state = monitor.process(state, raw_event_data=raw_event)
    assert state["current_event"] is not None

    # 2. Triage
    state = triage.process(state)
    assert state["current_alert"]["severity"] == "CRITICAL"

    # 3. Simulate Approved Response Plan (Hima's HITL output)
    plan = ResponsePlan(
        alert_id=state["current_alert"]["alert_id"],
        actions=[
            ResponseAction(action_type=ActionType.BLOCK_IP, target="198.51.100.55")
        ]
    )
    state["response_plan"] = plan.model_dump()

    # 4. Response Execution
    state = executor.process(state)
    assert len(state["execution_results"]) == 1
    assert state["execution_results"][0]["status"] == "SUCCESS"
    assert firewall.is_blocked("198.51.100.55") is True

    # 5. Verification
    state = verifier.process(state)
    assert state["verification_result"]["threat_cleared"] is True
    assert state["verification_result"]["confidence"] >= 0.90

    agent_log("PIPELINE", ">>> TEST 1 PASSED: Threat successfully neutralized and verified!\n")


def test_scenario_2_closed_loop_escalation():
    agent_log("PIPELINE", "\n=======================================================")
    agent_log("PIPELINE", "TEST 2: Closed-Loop Escalation (Verify Fails -> Adapt to /24 Subnet Ban -> Re-Execute -> Cleared)")
    agent_log("PIPELINE", "=======================================================")

    firewall = FirewallDriver()
    firewall.reset_rules()

    monitor = MonitoringAgent()
    triage = TriageAgent()
    executor = ResponseExecutionAgent(firewall=firewall)
    verifier = VerificationAgent(firewall=firewall)
    adapter = AdaptEscalateAgent()

    state: AgentState = {"audit_logs": [], "escalation_count": 0}

    # 1. Monitoring & Triage
    raw_event = {
        "src_ip": "172.16.5.99",
        "dst_ip": "10.0.0.2",
        "src_port": 40001,
        "dst_port": 22,
        "protocol": "TCP",
        "duration": 0.1,
        "packet_count": 50,
        "flags": "SYN"
    }
    state = monitor.process(state, raw_event_data=raw_event)
    state = triage.process(state)

    # Initial plan: Block single IP
    plan = ResponsePlan(
        alert_id=state["current_alert"]["alert_id"],
        actions=[ResponseAction(action_type=ActionType.BLOCK_IP, target="172.16.5.99")]
    )
    state["response_plan"] = plan.model_dump()
    state = executor.process(state)

    # Simulate Attacker Evasion: Attacker continues penetrating using another host in the same subnet
    state["test_post_action_samples"] = [
        {"src_ip": "172.16.5.99", "packet_count": 45}  # 45 packets still arriving!
    ]

    # Verification Step 1: Should detect threat persists
    state = verifier.process(state)
    assert state["verification_result"]["threat_cleared"] is False

    # Escalation Step 1: Adapt & Escalate Agent triggers Level 1 Subnet Ban
    state = adapter.process(state)
    assert state["escalation_decision"]["escalation_level"] == EscalationLevel.SUBNET_BAN.value
    assert state["escalation_count"] == 1

    # Loop Re-Execution: Execution Agent runs adapted plan (/24 Subnet Ban)
    state = executor.process(state)
    assert firewall.is_blocked("172.16.5.100") is True  # Entire subnet is now blocked!

    # Re-Verification Step 2: Now that subnet is blocked, threat is cleared
    state["test_post_action_samples"] = []  # No packets leak through subnet ban
    state = verifier.process(state)
    assert state["verification_result"]["threat_cleared"] is True

    agent_log("PIPELINE", ">>> TEST 2 PASSED: Threat persisted, successfully escalated to /24 ban, and verified cleared!\n")


def test_scenario_3_max_escalation_guardrail():
    agent_log("PIPELINE", "\n=======================================================")
    agent_log("PIPELINE", "TEST 3: Max Escalation Guardrail (3 Failures -> TIER2 Human Handover)")
    agent_log("PIPELINE", "=======================================================")

    adapter = AdaptEscalateAgent()
    state: AgentState = {
        "verification_result": {
            "threat_cleared": False,
            "target_ip": "10.99.99.99",
            "plan_id": "TEST_PLAN_MAX"
        },
        "escalation_count": 2,  # Already escalated twice
        "audit_logs": []
    }

    # 3rd escalation attempt should trigger Tier-2 Analyst handover
    state = adapter.process(state)
    decision = state["escalation_decision"]

    assert decision["escalation_level"] == EscalationLevel.TIER2_NOTIFY.value
    assert decision["requires_tier2_human"] is True
    assert state["escalation_count"] == 3

    agent_log("PIPELINE", ">>> TEST 3 PASSED: Autonomous threshold respected, Tier-2 Analyst summoned!\n")


if __name__ == "__main__":
    test_scenario_1_happy_path()
    test_scenario_2_closed_loop_escalation()
    test_scenario_3_max_escalation_guardrail()
    print("===============================================================")
    print("ALL PHANI'S PIPELINE TESTS PASSED WITH 100% SUCCESS!")
    print("===============================================================")
