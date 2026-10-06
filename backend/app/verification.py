from __future__ import annotations

import re
from collections import Counter

from .documents import Passage
from .ollama_client import assess_claim_with_ollama

STOP_WORDS = {"about", "after", "among", "because", "been", "being", "could", "during", "each", "from", "have", "into", "more", "most", "other", "over", "same", "such", "than", "that", "their", "there", "these", "they", "this", "those", "through", "under", "were", "which", "while", "with", "would", "will", "also", "both", "between", "companies", "company"}
MAX_OLLAMA_ASSESSMENTS = 60


def tokens(text: str) -> list[str]:
    return [word for word in re.findall(r"[a-z0-9]+", text.lower()) if len(word) > 2 and word not in STOP_WORDS]


def percentages(text: str) -> list[float]:
    found = []
    for raw in re.findall(r"(?<![A-Za-z])[-+]?\d+(?:,\d{3})*(?:\.\d+)?\s*%", text):
        found.append(float(raw.replace(",", "").replace("%", "").strip()))
    return found


def _rank_passages(claim: Passage, sources: list[tuple[str, list[Passage]]]) -> list[tuple[float, str, Passage]]:
    claim_tokens = set(tokens(claim.text))
    ranked = []
    for filename, passages in sources:
        for passage in passages:
            source_tokens = set(tokens(passage.text))
            if not claim_tokens or not source_tokens:
                continue
            overlap = len(claim_tokens & source_tokens) / len(claim_tokens)
            ranked.append((overlap, filename, passage))
    return sorted(ranked, key=lambda entry: entry[0], reverse=True)


def _deterministic_finding(claim: Passage, ranked: list[tuple[float, str, Passage]]) -> dict:
    evidence = []
    status = "unsupported"
    explanation = "No sufficiently similar passage was found in the supplied sources."
    if ranked and ranked[0][0] >= 0.25:
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
        for score, alt_filename, alt in ranked[1:4]:
            if score < 0.25:
                continue
            evidence.append({"source": alt_filename, "location": alt.location, "text": alt.text[:1200], "match_score": round(score, 3)})
    return {"claim": claim.text, "report_location": claim.location, "status": status, "explanation": explanation, "evidence": evidence, "analysis_method": "deterministic_fallback"}


def verify_claim(claim: Passage, sources: list[tuple[str, list[Passage]]], use_ollama: bool = True) -> dict:
    ranked = _rank_passages(claim, sources)
    fallback = _deterministic_finding(claim, ranked)
    if not use_ollama or not ranked or ranked[0][0] < 0.12:
        return fallback

    candidates = [
        {"id": index, "text": passage.text[:1600]}
        for index, (_, _, passage) in enumerate(ranked[:4], start=1)
    ]
    assessment = assess_claim_with_ollama(claim.text, candidates)
    if assessment is None:
        return fallback

    evidence = []
    for evidence_id in assessment["evidence_ids"]:
        _, filename, passage = ranked[evidence_id - 1]
        evidence.append({
            "source": filename,
            "location": passage.location,
            "text": passage.text[:1200],
            "match_score": round(ranked[evidence_id - 1][0], 3),
        })
    status = assessment["status"]
    if status != "unsupported" and not evidence:
        status = "unsupported"
        explanation = "The model did not select a source passage to support this finding."
    else:
        explanation = assessment["explanation"][:600]
    return {
        "claim": claim.text,
        "report_location": claim.location,
        "status": status,
        "explanation": explanation,
        "evidence": evidence,
        "analysis_method": "ollama",
    }


def build_ledger(claims: list[Passage], sources: list[tuple[str, list[Passage]]]) -> dict:
    findings = []
    ollama_attempts = 0
    for claim in claims:
        ranked = _rank_passages(claim, sources)
        should_assess = bool(ranked and ranked[0][0] >= 0.12 and ollama_attempts < MAX_OLLAMA_ASSESSMENTS)
        if should_assess:
            ollama_attempts += 1
        findings.append(verify_claim(claim, sources, use_ollama=should_assess))
    counts = Counter(item["status"] for item in findings)
    total = len(findings)
    methods = Counter(item["analysis_method"] for item in findings)
    return {
        "summary": {
            "total_claims": total,
            "supported": counts["supported"],
            "partially_supported": counts["partially_supported"],
            "unsupported": counts["unsupported"],
            "contradicted": counts["contradicted"],
            "support_rate": round(100 * counts["supported"] / total) if total else 0,
            "ollama_assessed": methods["ollama"],
            "deterministic_fallback": methods["deterministic_fallback"],
        },
        "findings": findings,
        "notice": "Ollama compares report claims with retrieved source passages. Citations point to extracted source text. This is an AI-assisted first pass and requires human review; it does not establish factual truth.",
    }
