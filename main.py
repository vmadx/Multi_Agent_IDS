"""
Main Interactive Demo Runner for Phani's 5-Agent SOC Subsystem:
1. Monitoring Agent
2. Triage Agent
3. Response Execution Agent
4. Verification Agent
5. Adapt & Escalate Agent
"""

import os
import sys
import time

from src.agents import (
    MonitoringAgent,
    TriageAgent,
    ResponseExecutionAgent,
    VerificationAgent,
    AdaptEscalateAgent
)
from src.schemas import (
    AgentState,
    ResponsePlan,
    ResponseAction,
    ActionType
)
from src.simulation.firewall_driver import FirewallDriver
from src.utils import agent_log, COLORS

def run_phani_soc_demo():
    print(f"\n{COLORS['BOLD']}{COLORS['HEADER']}========================================================================={COLORS['ENDC']}")
    print(f"{COLORS['BOLD']}{COLORS['HEADER']}   AGENTIC AI NETWORK INTRUSION DETECTION & AUTONOMOUS RESPONSE (NIDS)   {COLORS['ENDC']}")
    print(f"{COLORS['BOLD']}{COLORS['HEADER']}                   PHANI'S 5-AGENT PIPELINE DEMO                         {COLORS['ENDC']}")
    print(f"{COLORS['BOLD']}{COLORS['HEADER']}========================================================================={COLORS['ENDC']}\n")

    sample_csv = os.path.join("data", "samples", "sample_flows.csv")
    if not os.path.exists(sample_csv):
        print("Sample data not found. Please verify data/samples/sample_flows.csv exists.")
        return

    # Initialize Firewall and Agents
    firewall = FirewallDriver()
    firewall.reset_rules()

    monitor = MonitoringAgent(csv_filepath=sample_csv)
    triage = TriageAgent(dedup_window_sec=60)
    executor = ResponseExecutionAgent(firewall=firewall)
    verifier = VerificationAgent(firewall=firewall)
    adapter = AdaptEscalateAgent()

    flow_idx = 0
    resolved_count = 0
    benign_count = 0
    escalated_count = 0

    while True:
        state: AgentState = {"audit_logs": [], "escalation_count": 0}

        # 1. Monitoring Ingestion
        state = monitor.process(state)
        event = state.get("current_event")
        if not event:
            # End of stream
            break

        flow_idx += 1
        print(f"\n--- [Flow #{flow_idx}] Telemetry Event Ingested ---")

        # 2. Triage
        state = triage.process(state)
        alert = state.get("current_alert")
        if not alert:
            continue

        severity = alert.get("severity")
        if severity in ("BENIGN", "LOW"):
            agent_log("PIPELINE", f"Flow #{flow_idx} marked as {severity}. Bypassing high-impact mitigation (Noise filtered).")
            benign_count += 1
            continue

        # 3. High/Critical Attack Detected -> Formulate Response Plan
        src_ip = alert.get("src_ip")
        category = alert.get("category")
        agent_log("PIPELINE", f"Flagged {severity} Incident [{category}]. Generating containment plan for [{src_ip}]...")

        plan = ResponsePlan(
            alert_id=alert.get("alert_id"),
            actions=[
                ResponseAction(
                    action_type=ActionType.BLOCK_IP,
                    target=src_ip,
                    priority=1,
                    parameters={"duration_sec": 3600}
                )
            ],
            approved_by="AUTOPILOT_HITL_VERIFIED"
        )
        state["response_plan"] = plan.model_dump()

        # 4. Response Execution
        state = executor.process(state)

        # 5. Closed-Loop Verification
        state = verifier.process(state)
        verif = state.get("verification_result")

        # 6. Adapt & Escalate (if verification fails)
        if not verif.get("threat_cleared"):
            state = adapter.process(state)
            escalation = state.get("escalation_decision")
            escalated_count += 1
            # Re-execute adapted plan
            state = executor.process(state)
            state = verifier.process(state)
        else:
            resolved_count += 1

    print(f"\n{COLORS['BOLD']}{COLORS['GREEN']}========================================================================={COLORS['ENDC']}")
    print(f"{COLORS['BOLD']}{COLORS['GREEN']}                        PIPELINE EXECUTION SUMMARY                       {COLORS['ENDC']}")
    print(f"{COLORS['BOLD']}{COLORS['GREEN']}========================================================================={COLORS['ENDC']}")
    print(f"Total Network Flows Analyzed:      {flow_idx}")
    print(f"Benign / Low-Risk Filtered Flows:  {benign_count}")
    print(f"Malicious Threats Mitigated & OK:  {resolved_count}")
    print(f"Incidents Escalated (Subnet/Host): {escalated_count}")
    print(f"Active Firewall Rules Installed:   {len(firewall.active_rules)}")
    print(f"{COLORS['BOLD']}{COLORS['GREEN']}========================================================================={COLORS['ENDC']}\n")

if __name__ == "__main__":
    run_phani_soc_demo()
