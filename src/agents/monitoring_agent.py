"""
Monitoring Agent (Phani - Agent 1)
Responsible for ingesting network telemetry (CSV batches or live flow streams),
validating raw fields, sanitizing corrupted records, normalizing into NetworkEvent models,
and passing them into the shared LangGraph AgentState.
"""

import csv
import os
from typing import Generator, Optional, Dict, Any
from src.schemas import NetworkEvent, AgentState
from src.utils import agent_log

class MonitoringAgent:
    def __init__(self, csv_filepath: Optional[str] = None):
        self.csv_filepath = csv_filepath
        self._stream_generator: Optional[Generator[Dict[str, Any], None, None]] = None
        if csv_filepath and os.path.exists(csv_filepath):
            self._stream_generator = self._create_csv_stream(csv_filepath)

    def _create_csv_stream(self, filepath: str) -> Generator[Dict[str, Any], None, None]:
        """Yields raw rows from a network flow CSV file one-by-one."""
        with open(filepath, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                yield row

    def validate_and_normalize(self, raw_data: Dict[str, Any]) -> Optional[NetworkEvent]:
        """
        Validates raw telemetry data and normalizes into a validated NetworkEvent model.
        Returns None if record is unrecoverably corrupted (e.g. missing essential IP/port).
        """
        src_ip = raw_data.get("src_ip", "").strip() if raw_data.get("src_ip") else ""
        dst_ip = raw_data.get("dst_ip", "").strip() if raw_data.get("dst_ip") else ""

        # Validation Rule 1: Source and Destination IPs are mandatory
        if not src_ip or not dst_ip:
            agent_log("MONITORING", f"Dropping corrupted record: Missing IP address ({raw_data})", level="WARNING")
            return None

        # Validation Rule 2: Safe integer casting for ports
        try:
            src_port = int(raw_data.get("src_port", 0))
            dst_port = int(raw_data.get("dst_port", 0))
        except (ValueError, TypeError):
            agent_log("MONITORING", f"Dropping corrupted record: Invalid port number ({raw_data})", level="WARNING")
            return None

        # Validation Rule 3: Sanitize negative or corrupted duration/packet counts
        try:
            duration = float(raw_data.get("duration", 0.0))
            if duration < 0:
                duration = 0.0  # Sanitize negative duration
            packet_count = max(1, int(raw_data.get("packet_count", 1)))
            byte_count = max(0, int(raw_data.get("byte_count", 0)))
        except (ValueError, TypeError):
            duration = 0.0
            packet_count = 1
            byte_count = 0

        protocol = str(raw_data.get("protocol", "TCP")).strip().upper()
        flags = raw_data.get("flags")

        # Create normalized NetworkEvent
        event = NetworkEvent(
            src_ip=src_ip,
            dst_ip=dst_ip,
            src_port=src_port,
            dst_port=dst_port,
            protocol=protocol,
            duration=duration,
            packet_count=packet_count,
            byte_count=byte_count,
            flags=flags,
            raw_features=raw_data
        )
        return event

    def get_next_event(self) -> Optional[NetworkEvent]:
        """Fetches the next valid event from the streaming source."""
        if not self._stream_generator:
            return None

        for raw_row in self._stream_generator:
            event = self.validate_and_normalize(raw_row)
            if event:
                return event
        return None

    def process(self, state: AgentState, raw_event_data: Optional[Dict[str, Any]] = None) -> AgentState:
        """
        LangGraph Node function interface.
        Reads raw data (or next CSV event), validates, and populates state['current_event'].
        """
        if raw_event_data:
            event = self.validate_and_normalize(raw_event_data)
        else:
            event = self.get_next_event()

        if event:
            state["current_event"] = event.model_dump()
            state["status"] = "INGESTED"
            audit = state.get("audit_logs", [])
            audit.append(f"MonitoringAgent: Ingested flow {event.src_ip}:{event.src_port} -> {event.dst_ip}:{event.dst_port}")
            state["audit_logs"] = audit
            agent_log("MONITORING", f"Ingested & normalized: {event.src_ip}:{event.src_port} -> {event.dst_ip}:{event.dst_port} [{event.protocol}] (Packets: {event.packet_count})")
        else:
            state["current_event"] = None
            agent_log("MONITORING", "No valid event to ingest (stream ended or record dropped).")

        return state
