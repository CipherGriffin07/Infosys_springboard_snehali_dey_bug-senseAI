"""
Agent Orchestrator
------------------
Runs the full multi-agent pipeline against a single bug:

1. Triage Agent
   -> severity, priority, category

2. Log Analysis Agent
   -> exception type, file, line, function, failure point

3. Duplicate Detection Agent
   -> top similar historical bugs

4. Root Cause Agent
   -> explainable root-cause analysis grounded in historical evidence

5. Remediation Agent
   -> recommended fix, prevention guidance, and effort estimate

6. AI Risk Scoring
   -> calculates a 0-100 risk score using the combined evidence from
      all previous agents.

The five core agents remain independent and unit-testable. Risk scoring
is performed after them because it depends on their combined output.
"""

from dataclasses import dataclass, asdict
from typing import List, Optional

from app.agents.triage import (
    TriageAgent,
    TriageResult,
)

from app.agents.log_analysis import (
    LogAnalysisAgent,
    LogAnalysisResult,
)

from app.agents.duplicate_detection import (
    DuplicateDetectionAgent,
    DuplicateMatch,
)

from app.agents.root_cause import (
    RootCauseAgent,
    RootCauseResult,
)

from app.agents.remediation import (
    RemediationAgent,
    RemediationResult,
)

from app.services.health_score import (
    BugRiskScoreResult,
    compute_bug_risk_score,
)


@dataclass
class PipelineResult:
    triage: TriageResult
    log_analysis: LogAnalysisResult
    duplicates: List[DuplicateMatch]
    root_cause: RootCauseResult
    remediation: RemediationResult
    risk_score: BugRiskScoreResult

    def to_dict(self) -> dict:
        """
        Convert the complete multi-agent pipeline result into a
        JSON-serializable dictionary.
        """

        return {
            "triage": asdict(
                self.triage
            ),

            "log_analysis": asdict(
                self.log_analysis
            ),

            "duplicates": [
                asdict(duplicate)
                for duplicate
                in self.duplicates
            ],

            "root_cause": asdict(
                self.root_cause
            ),

            "remediation": asdict(
                self.remediation
            ),

            "risk_score": asdict(
                self.risk_score
            ),
        }


class AgentOrchestrator:
    def __init__(self):
        self.triage_agent = (
            TriageAgent()
        )

        self.log_agent = (
            LogAnalysisAgent()
        )

        self.dup_agent = (
            DuplicateDetectionAgent()
        )

        self.root_cause_agent = (
            RootCauseAgent()
        )

        self.remediation_agent = (
            RemediationAgent()
        )

    def run(
        self,
        title: str,
        description: str,
        stack_trace: Optional[str],
        corpus: List[dict],
    ) -> PipelineResult:
        """
        Run the complete intelligent bug-diagnosis pipeline.

        corpus:
            Historical bugs used for duplicate detection and
            retrieval-augmented root-cause/remediation reasoning.

        Expected corpus fields generally include:

            id
            title
            description
            status
            resolution_notes

        Additional fields are allowed.
        """

        # ===========================================================
        # 1. TRIAGE
        # ===========================================================

        triage = self.triage_agent.run(
            title,
            description,
            stack_trace,
        )

        # ===========================================================
        # 2. LOG ANALYSIS
        # ===========================================================

        log_analysis = self.log_agent.run(
            stack_trace
        )

        # ===========================================================
        # 3. DUPLICATE DETECTION
        # ===========================================================

        query_text = (
            f"{title} {description}"
        )

        duplicates = self.dup_agent.run(
            query_text,
            corpus,
            top_k=5,
        )

        # ===========================================================
        # 4. ROOT CAUSE ANALYSIS
        # ===========================================================

        root_cause = (
            self.root_cause_agent.run(
                similar_resolved=duplicates,
                exception_type=(
                    log_analysis.exception_type
                ),
                category=(
                    triage.category
                ),
            )
        )

        # ===========================================================
        # 5. REMEDIATION
        # ===========================================================

        remediation = (
            self.remediation_agent.run(
                similar_resolved=duplicates,
                exception_type=(
                    log_analysis.exception_type
                ),
                category=(
                    triage.category
                ),
                severity=(
                    triage.severity
                ),
            )
        )

        # ===========================================================
        # 6. HISTORICAL DUPLICATE SIGNAL
        # ===========================================================

        duplicate_similarities = []

        for duplicate in duplicates:
            similarity = getattr(
                duplicate,
                "similarity",
                None,
            )

            if similarity is None:
                continue

            try:
                similarity = float(
                    similarity
                )
            except (
                TypeError,
                ValueError,
            ):
                continue

            # Some implementations may represent similarity
            # between 0 and 1 instead of 0 and 100.
            if (
                similarity > 0
                and similarity <= 1
            ):
                similarity *= 100

            duplicate_similarities.append(
                similarity
            )

        best_duplicate_similarity = (
            max(
                duplicate_similarities
            )
            if duplicate_similarities
            else 0.0
        )

        recurrence_count = sum(
            1
            for similarity
            in duplicate_similarities
            if similarity >= 50
        )

        # ===========================================================
        # 7. ROOT CAUSE CONFIDENCE
        # ===========================================================

        root_cause_confidence = getattr(
            root_cause,
            "confidence",
            None,
        )

        # Support an alternative field name if the existing
        # RootCauseResult uses confidence_score.
        if root_cause_confidence is None:
            root_cause_confidence = getattr(
                root_cause,
                "confidence_score",
                None,
            )

        # ===========================================================
        # 8. AI BUG RISK SCORE
        # ===========================================================

        risk_score = (
            compute_bug_risk_score(
                severity=getattr(
                    triage,
                    "severity",
                    None,
                ),

                priority=getattr(
                    triage,
                    "priority",
                    None,
                ),

                root_cause_confidence=(
                    root_cause_confidence
                ),

                duplicate_similarity=(
                    best_duplicate_similarity
                ),

                exception_type=(
                    log_analysis.exception_type
                ),

                failure_file=(
                    log_analysis.failure_file
                ),

                failure_line=(
                    log_analysis.failure_line
                ),

                recurrence_count=(
                    recurrence_count
                ),
            )
        )

        # ===========================================================
        # FINAL COMBINED RESULT
        # ===========================================================

        return PipelineResult(
            triage=triage,
            log_analysis=log_analysis,
            duplicates=duplicates,
            root_cause=root_cause,
            remediation=remediation,
            risk_score=risk_score,
        )