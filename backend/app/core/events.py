"""Lightweight in-process event bus (Event-Driven Design).

Modules publish domain events; subscribers react (e.g. a Detection completing
auto-creates a Case timeline entry, or seeds the agent's memory). The interface
is broker-agnostic: swap `_InProcessBus` for a Redis/Kafka-backed implementation
later without touching publishers or subscribers.

Handlers run synchronously and are isolated — one failing handler is logged and
does not break the publisher or other handlers.
"""
from __future__ import annotations

import logging
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Callable

logger = logging.getLogger("justiceai.events")


@dataclass
class Event:
    """A domain event. `name` is dotted, e.g. 'detection.completed'."""

    name: str
    payload: dict = field(default_factory=dict)
    occurred_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


Handler = Callable[[Event], None]


class _InProcessBus:
    def __init__(self) -> None:
        self._handlers: dict[str, list[Handler]] = defaultdict(list)

    def subscribe(self, event_name: str, handler: Handler) -> None:
        self._handlers[event_name].append(handler)

    def publish(self, event: Event) -> None:
        for handler in self._handlers.get(event.name, []):
            try:
                handler(event)
            except Exception:  # noqa: BLE001 - isolate subscriber failures
                logger.exception("event handler failed for %s", event.name)


# Module-level singleton. Import and use directly.
bus = _InProcessBus()


def publish(name: str, **payload) -> Event:
    event = Event(name=name, payload=payload)
    bus.publish(event)
    return event


def subscribe(event_name: str):
    """Decorator form: @subscribe('detection.completed')."""

    def _wrap(fn: Handler) -> Handler:
        bus.subscribe(event_name, fn)
        return fn

    return _wrap
