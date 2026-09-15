"""
Remediation Agent
------------------
Recommends a concrete fix approach, grounded first in what actually worked
for similar past bugs (retrieved from the knowledge base), then supplemented
with general best-practice guidance keyed off the exception type and
category. Also produces a rough fix-time estimate, which is deliberately
conservative and heuristic — it exists to help with sprint planning, not as
a guarantee.
"""
from dataclasses import dataclass
from typing import List, Optional

from app.agents.duplicate_detection import DuplicateMatch

BEST_PRACTICES = {
    "NullPointerException": [
        "Add a null/None check before dereferencing the value.",
        "Prefer optional-chaining or default values at the boundary where the value first enters your code.",
    ],
    "TypeError": [
        "Validate input types at function boundaries, especially for external/API input.",
        "Add a guard clause for null/undefined before property access.",
    ],
    "KeyError": [
        "Use `.get(key, default)` instead of direct indexing where the key may be absent.",
        "Validate the expected schema of incoming data before processing it.",
    ],
    "IndexError": [
        "Check `len()` before indexing, or use safe slicing instead of direct index access.",
    ],
    "AttributeError": [
        "Confirm the object's type/shape before calling methods on it — it may be None or a different type than expected.",
    ],
    "ConnectionError": [
        "Add retries with exponential backoff for transient network failures.",
        "Add a circuit breaker or timeout so one failing dependency doesn't cascade.",
    ],
    "TimeoutError": [
        "Profile the slow call; consider caching, indexing, or async execution.",
        "Set an explicit, sane timeout instead of relying on defaults.",
    ],
    "IntegrityError": [
        "Validate uniqueness/foreign-key constraints in application code before the write, with a clear user-facing error.",
        "Wrap the write in a transaction and handle the constraint violation explicitly.",
    ],
    "PermissionError": [
        "Verify the authorization check happens before the operation, not after.",
    ],
}

CATEGORY_BEST_PRACTICES = {
    "Frontend": ["Add an error boundary around this component so one failure doesn't blank the whole page."],
    "Backend": ["Add a regression test that reproduces this exact input before closing the ticket."],
    "Database": ["Check whether a migration or index is needed alongside the code fix."],
    "Infra": ["Confirm the fix in staging under production-like config before rolling out."],
    "API": ["Add input validation at the API boundary and return a clear 4xx instead of a 500."],
    "Mobile": ["Test the fix on both the oldest and newest supported OS versions."],
}

SEVERITY_BASE_HOURS = {"Critical": 4, "High": 6, "Medium": 10, "Low": 16}


@dataclass
class RemediationResult:
    suggested_fix: str
    best_practices: List[str]
    prevention_tips: List[str]
    estimated_fix_time_hours: float
    grounded_in: List[int]


class RemediationAgent:
    name = "Remediation Agent"

    def run(
        self,
        similar_resolved: List[DuplicateMatch],
        exception_type: Optional[str],
        category: str,
        severity: str,
    ) -> RemediationResult:
        resolved_with_notes = [m for m in similar_resolved if m.status in ("Resolved", "Closed") and m.resolution_notes]
        best_practices = list(BEST_PRACTICES.get(exception_type or "", []))
        best_practices += CATEGORY_BEST_PRACTICES.get(category, [])
        if not best_practices:
            best_practices = ["Add a regression test that reproduces this bug before marking it resolved."]

        if resolved_with_notes:
            top = resolved_with_notes[0]
            suggested_fix = (
                f"The most similar resolved bug (#{top.bug_id}, \"{top.title}\", "
                f"{top.similarity:.0f}% similar) was fixed with: {top.resolution_notes.strip()[:280]} "
                f"— start by checking whether the same fix applies here."
            )
            grounded_in = [m.bug_id for m in resolved_with_notes[:3]]
            # A precedent exists, so the fix is usually faster than starting cold.
            time_multiplier = 0.6
        else:
            suggested_fix = (
                f"No directly matching fix exists in the knowledge base yet. Based on the "
                f"{exception_type or 'reported'} failure in the {category} layer, start by "
                f"reproducing it locally with the same input/stack trace, then apply the "
                f"best practices below. Recording the fix here will help resolve similar bugs "
                f"faster next time."
            )
            grounded_in = []
            time_multiplier = 1.0

        prevention_tips = [
            "Add a regression test covering this exact scenario.",
            "Log this failure mode in the team's knowledge base with the fix, so duplicate detection can find it next time.",
        ]
        if category in CATEGORY_BEST_PRACTICES:
            prevention_tips.append(CATEGORY_BEST_PRACTICES[category][0])

        base_hours = SEVERITY_BASE_HOURS.get(severity, 10)
        estimated_hours = round(base_hours * time_multiplier, 1)

        return RemediationResult(
            suggested_fix=suggested_fix,
            best_practices=best_practices[:4],
            prevention_tips=prevention_tips[:3],
            estimated_fix_time_hours=estimated_hours,
            grounded_in=grounded_in,
        )
