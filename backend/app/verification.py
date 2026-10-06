from __future__ import annotations

import re
from collections import Counter

from .documents import Passage

STOP_WORDS = {"about", "after", "among", "because", "been", "being", "could", "during", "each", "from", "have", "into", "more", "most", "other", "over", "same", "such", "than", "that", "their", "there", "these", "they", "this", "those", "through", "under", "were", "which", "while", "with", "would", "will", "also", "both", "between", "companies", "company"}


def tokens(text: str) -> list[str]:
    return [word for word in re.findall(r"[a-z0-9]+", text.lower()) if len(word) > 2 and word not in STOP_WORDS]


def percentages(text: str) -> list[float]:
    found = []
    for raw in re.findall(r"(?<![A-Za-z])[-+]?\d+(?:,\d{3})*(?:\.\d+)?\s*%", text):
        found.append(float(raw.replace(",", "").replace("%", "").strip()))
    return found


def verify_claim(claim: Passage, sources: list[tuple[str, list[Passage]]]) -> dict:
    claim_tokens = set(tokens(claim.text))
    ranked = []
    for filename, passages in sources:
        for passage in passages:
            source_tokens = set(tokens(passage.text))
            if not claim_tokens or not source_tokens:
                continue
            overlap = len(claim_tokens & source_tokens) / len(claim_tokens)
            if overlap >= 0.25:
                ranked.append((overlap, filename, passage))
    ranked.sort(key=lambda entry: entry[0], reverse=True)
    evidence = []
    status = "unsupported"
    explanation = "No sufficiently similar passage was found in the supplied sources."
    if ranked:
        best_score, filename, passage = ranked[0]
        claim_nums, source_nums = percentages(claim.text), percentages(passage.text)
        evidence = [{"source": filename, "location": passage.location, "text": passage.text[:1200], "match_score": round(best_score, 3)}]
        if claim_nums and source_nums and not any(abs(a - b) < max(0.01, abs(a) * 0.005) for a in claim_nums for b in source_nums):
            status = "contradicted"
            explanation = "The closest matching passage contains numeric value(s) that do not match the claim. Review units, dates, and context."
        elif best_score >= 0.72 and (not claim_nums or (source_nums and any(abs(a - b) < max(0.01, abs(a) * 0.005) for a in claim_nums for b in source_nums))):
            status = "supported"
            explanation = "A closely matching source passage was found. Confirm the context and scope during review."
        else:
            status = "partially_supported"
            explanation = "A related passage was found, but it may not establish every part of the claim."
        # Include close alternatives so conflicts are visible in the ledger.
        for score, alt_filename, alt in ranked[1:4]:
            evidence.append({"source": alt_filename, "location": alt.location, "text": alt.text[:1200], "match_score": round(score, 3)})
    return {"claim": claim.text, "report_location": claim.location, "status": status, "explanation": explanation, "evidence": evidence}


def build_ledger(claims: list[Passage], sources: list[tuple[str, list[Passage]]]) -> dict:
    findings = [verify_claim(claim, sources) for claim in claims]
    counts = Counter(item["status"] for item in findings)
    total = len(findings)
    return {
        "summary": {
            "total_claims": total,
            "supported": counts["supported"],
            "partially_supported": counts["partially_supported"],
            "unsupported": counts["unsupported"],
            "contradicted": counts["contradicted"],
            "support_rate": round(100 * counts["supported"] / total) if total else 0,
        },
        "findings": findings,
        "notice": "Automated first-pass matching only. Findings require human review; text extraction and similarity are not proof of factual support.",
    }
