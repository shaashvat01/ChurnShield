"use client";

import { useState, useCallback, useRef } from "react";
import { API_BASE_URL } from "@/config";
import type { AnalysisResponse } from "@/types";

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 60;

export function useAnalysis() {
  const [data, setData] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const abortRef = useRef<AbortController | null>(null);

  const analyze = useCallback(async (eventText: string) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);
    setData(null);
    setStatus("Submitting analysis...");

    try {
      const submitResp = await fetch(`${API_BASE_URL}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_text: eventText }),
        signal: abortRef.current.signal,
      });

      if (!submitResp.ok) {
        const body = await submitResp.json().catch(() => ({}));
        throw new Error(body.error || `Submit failed: ${submitResp.status}`);
      }

      const { job_id } = await submitResp.json();
      setStatus("Processing Census LODES + QCEW + WARN data...");

      for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

        if (abortRef.current.signal.aborted) return null;

        const pollResp = await fetch(`${API_BASE_URL}/results/${job_id}`, {
          signal: abortRef.current.signal,
        });

        if (!pollResp.ok) continue;

        const pollData = await pollResp.json();

        if (pollData.status === "complete") {
          setData(pollData.result);
          return pollData.result;
        }

        if (pollData.status === "error") {
          throw new Error(pollData.error || "Analysis failed");
        }

        const messages = [
          "Loading LODES commute flow data...",
          "Parsing event and resolving location...",
          "Computing Moretti multiplier impacts...",
          "Distributing impact across ZIP codes...",
          "Analyzing business exposure by NAICS...",
          "Cross-referencing WARN Act filings...",
          "Building BLS comparison baseline...",
          "Generating final report...",
        ];
        setStatus(messages[Math.min(attempt, messages.length - 1)]);
      }

      throw new Error("Analysis timed out — please try again");
    } catch (err: any) {
      if (err.name === "AbortError") return null;
      setError(err.message || "Failed to analyze event");
      return null;
    } finally {
      setLoading(false);
      setStatus("");
    }
  }, []);

  return { data, loading, error, status, analyze };
}
