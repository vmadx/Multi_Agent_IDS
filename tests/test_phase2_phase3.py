"""
Integration test for Phase 2 (Monitoring Agent) and Phase 3 (Triage Agent).
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.agents.monitoring_agent import MonitoringAgent
from src.agents.triage_agent import TriageAgent
from src.schemas import AgentState, SeverityLevel
from src.utils import agent_log

def test_monitoring_and_triage():
    agent_log("PIPELINE", "==================================================")
    agent_log("PIPELINE", "Running Phase 2 & Phase 3 Integration Test...")
    agent_log("PIPELINE", "==================================================")

    sample_csv = os.path.join("data", "samples", "sample_flows.csv")
    monitor = MonitoringAgent(csv_filepath=sample_csv)
    triage = TriageAgent(dedup_window_sec=60)

    events_processed = 0
    alerts_generated = 0
    severity_counts = {}

    while True:
        state: AgentState = {"audit_logs": []}
        
        # Phase 2: Monitoring Ingest
        state = monitor.process(state)
        if not state.get("current_event"):
            # Stream ended
            break

        events_processed += 1

        # Phase 3: Triage Filter
        state = triage.process(state)
        alert = state.get("current_alert")
        if alert:
            alerts_generated += 1
            sev = alert["severity"]
            severity_counts[sev] = severity_counts.get(sev, 0) + 1

    print("\n----------------- SUMMARY RESULTS -----------------")
    print(f"Total Valid Flows Ingested: {events_processed}")
    print(f"Total Alerts Generated:      {alerts_generated}")
    print(f"Severity Breakdown:          {severity_counts}")
    print("---------------------------------------------------")

    # Assertions
    assert events_processed >= 10, f"Expected at least 10 valid flows, got {events_processed}"
    assert SeverityLevel.CRITICAL.value in severity_counts, "Expected CRITICAL alerts for SYN flood"
    assert SeverityLevel.HIGH.value in severity_counts, "Expected HIGH alerts for Port Scan / Brute Force"
    
    print("\n>>> PHASE 2 & 3 INTEGRATION TEST PASSED SUCCESSFULLY! <<<\n")

if __name__ == "__main__":
    test_monitoring_and_triage()
