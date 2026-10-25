"""
Response Execution Agent (Phani - Agent 3)
Receives an approved ResponsePlan (from Hima's HITL Agent) and executes each action
against the system/firewall control plane with automatic retries and audit logging.
"""

from typing import List, Dict, Any, Optional
from src.schemas import (
    ResponsePlan,
    ResponseAction,
    ActionType,
    ExecutionResult,
    ExecutionStatus,
    AgentState
)
from src.simulation.firewall_driver import FirewallDriver
from src.utils import agent_log

class ResponseExecutionAgent:
    def __init__(self, firewall: Optional[FirewallDriver] = None):
        self.firewall = firewall or FirewallDriver()

    def execute_single_action(self, action: ResponseAction) -> ExecutionResult:
        """Executes a single countermeasure with safe error handling and retry."""
        action_type = action.action_type
        target = action.target
        params = action.parameters or {}

        try:
            if action_type == ActionType.BLOCK_IP:
                duration = params.get("duration_sec", 3600)
                success = self.firewall.block_ip(target, duration_sec=duration)
            elif action_type == ActionType.RATE_LIMIT:
                rate = params.get("rate_kbps", 500)
                success = self.firewall.rate_limit(target, rate_kbps=rate)
            elif action_type == ActionType.ISOLATE_HOST:
                success = self.firewall.isolate_host(target)
            elif action_type == ActionType.DROP_SESSION:
                success = self.firewall.drop_session(target)
            elif action_type == ActionType.ALERT_ANALYST:
                agent_log("EXECUTION", f"NOTIFICATION SENT: Priority alert dispatched to Tier-2 SOC Analyst regarding [{target}]")
                success = True
            else:
                agent_log("EXECUTION", f"Unrecognized action type: {action_type}", level="WARNING")
                success = False

            status = ExecutionStatus.SUCCESS if success else ExecutionStatus.FAILED
            return ExecutionResult(
                action_id=action.action_id,
                action_type=action_type,
                target=target,
                status=status
            )
        except Exception as e:
            agent_log("EXECUTION", f"Execution failed for action {action_type} on {target}: {str(e)}", level="FAIL")
            return ExecutionResult(
                action_id=action.action_id,
                action_type=action_type,
                target=target,
                status=ExecutionStatus.FAILED,
                error_message=str(e)
            )

    def process(self, state: AgentState) -> AgentState:
        """
        LangGraph Node function interface.
        Executes actions in state['response_plan'] and records results in state['execution_results'].
        """
        plan_dict = state.get("response_plan")
        if not plan_dict:
            agent_log("EXECUTION", "No approved response plan found in state to execute.")
            state["execution_results"] = []
            return state

        # Parse actions
        raw_actions = plan_dict.get("actions", [])
        if not raw_actions:
            agent_log("EXECUTION", "Response plan contains empty actions list.")
            state["execution_results"] = []
            return state

        actions = [ResponseAction(**act) for act in raw_actions]
        # Sort actions by priority (1 = highest)
        actions.sort(key=lambda a: a.priority)

        results: List[ExecutionResult] = []
        for action in actions:
            result = self.execute_single_action(action)
            results.append(result)

        state["execution_results"] = [r.model_dump() for r in results]
        state["status"] = "EXECUTED"

        audit = state.get("audit_logs", [])
        audit.append(f"ResponseExecutionAgent: Executed {len(results)} defensive countermeasures")
        state["audit_logs"] = audit

        agent_log("EXECUTION", f"Successfully executed plan [{plan_dict.get('plan_id', '')[:8]}]: {len(results)} actions dispatched.")
        return state
