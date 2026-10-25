"""
Structured Logger for Multi-Agent Network Intrusion Detection System.
Provides formatted, readable console logging with timestamps and agent badges.
"""

import logging
import sys

# ANSI Color codes for clean console output during demos
COLORS = {
    "HEADER": "\033[95m",
    "BLUE": "\033[94m",
    "CYAN": "\033[96m",
    "GREEN": "\033[92m",
    "WARNING": "\033[93m",
    "FAIL": "\033[91m",
    "ENDC": "\033[0m",
    "BOLD": "\033[1m"
}

AGENT_BADGES = {
    "MONITORING": f"{COLORS['CYAN']}[MONITORING AGENT]{COLORS['ENDC']}",
    "TRIAGE": f"{COLORS['WARNING']}[TRIAGE AGENT]{COLORS['ENDC']}",
    "EXECUTION": f"{COLORS['FAIL']}[EXECUTION AGENT]{COLORS['ENDC']}",
    "VERIFICATION": f"{COLORS['BLUE']}[VERIFICATION AGENT]{COLORS['ENDC']}",
    "ESCALATION": f"{COLORS['HEADER']}[ADAPT & ESCALATE AGENT]{COLORS['ENDC']}",
    "PIPELINE": f"{COLORS['GREEN']}[PIPELINE CONTROLLER]{COLORS['ENDC']}"
}

def setup_logger(name: str = "NIDS_AGENT") -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        logger.setLevel(logging.INFO)
        formatter = logging.Formatter(
            fmt="%(asctime)s [%(levelname)s] %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )
        ch = logging.StreamHandler(sys.stdout)
        ch.setFormatter(formatter)
        logger.addHandler(ch)
    return logger

def agent_log(agent_name: str, message: str, level: str = "INFO"):
    badge = AGENT_BADGES.get(agent_name.upper(), f"[{agent_name.upper()}]")
    print(f"{badge} {message}")
