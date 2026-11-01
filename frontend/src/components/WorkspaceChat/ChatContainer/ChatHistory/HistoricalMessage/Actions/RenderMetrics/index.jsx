import { formatDateTimeAsMoment } from "@/utils/directories";
import { formatDuration, numberWithCommas } from "@/utils/numbers";
import {
  getShowChatMetrics,
  setShowChatMetrics,
  SHOW_METRICS_EVENT,
} from "@/utils/chatMetrics";
import React, { useEffect, useState, useContext } from "react";
import { isMobile } from "react-device-detect";
const MetricsContext = React.createContext();

/**
 * Format the output TPS to a string
 * @param {number} outputTps - output TPS
 * @returns {string}
 */
function formatTps(outputTps) {
  try {
    return outputTps < 1000
      ? outputTps.toFixed(2)
      : numberWithCommas(outputTps.toFixed(0));
  } catch {
    return "";
  }
}

/**
 * Format the prompt/completion token usage for the metrics line.
 * @param {{prompt_tokens?: number, completion_tokens?: number, total_tokens?: number}} metrics
 * @returns {string}
 */
function formatTokenUsage(metrics = {}) {
  const prompt = Number(metrics.prompt_tokens);
  const completion = Number(metrics.completion_tokens);
  const knownPrompt = Number.isFinite(prompt) && prompt > 0 ? prompt : 0;
  const knownCompletion =
    Number.isFinite(completion) && completion > 0 ? completion : 0;
  const total = Number(metrics.total_tokens) || knownPrompt + knownCompletion;
  if (!Number.isFinite(total) || total <= 0) return "";

  const parts = [];
  if (knownPrompt > 0)
    parts.push(`${numberWithCommas(Math.round(knownPrompt))} prompt`);
  if (knownCompletion > 0)
    parts.push(`${numberWithCommas(Math.round(knownCompletion))} completion`);

  const totalString = numberWithCommas(Math.round(total));
  return parts.length > 0
    ? `${totalString} tok (${parts.join(" · ")})`
    : `${totalString} tok`;
}

/**
 * Build the metrics string for a given metrics object
 * - Model name
 * - Duration and output TPS (when reported)
 * - Token usage
 * - Timestamp
 * @param {metrics: {duration:number, outputTps: number, prompt_tokens: number, completion_tokens: number, total_tokens: number, model?: string, timestamp?: number}} metrics
 * @returns {string}
 */
function buildMetricsString(metrics = {}) {
  const parts = [];
  if (metrics?.model) parts.push(metrics.model);

  if (metrics?.duration) {
    const duration = formatDuration(metrics.duration);
    const tps = Number(metrics.outputTps);
    parts.push(
      Number.isFinite(tps) && tps > 0
        ? `${duration} (${formatTps(tps)} tok/s)`
        : duration
    );
  }

  const tokens = formatTokenUsage(metrics);
  if (tokens) parts.push(tokens);

  if (metrics?.timestamp)
    parts.push(formatDateTimeAsMoment(metrics.timestamp, "MMM D, h:mm A"));

  return parts.join(" · ");
}

/**
 * Provider for the metrics context that controls the visibility of the metrics
 * per-chat based on the user's preference.
 * @param {React.ReactNode} children
 * @returns {React.ReactNode}
 */
export function MetricsProvider({ children }) {
  const [showMetricsAutomatically, setShowMetricsAutomatically] =
    useState(getShowChatMetrics);

  useEffect(() => {
    function handleShowingMetricsEvent(e) {
      if (!e?.detail?.hasOwnProperty("showMetricsAutomatically")) return;
      setShowMetricsAutomatically(e.detail.showMetricsAutomatically);
    }
    console.log("Adding event listener for metrics visibility");
    window.addEventListener(SHOW_METRICS_EVENT, handleShowingMetricsEvent);
    return () =>
      window.removeEventListener(SHOW_METRICS_EVENT, handleShowingMetricsEvent);
  }, []);

  return (
    <MetricsContext.Provider
      value={{ showMetricsAutomatically, setShowMetricsAutomatically }}
    >
      {children}
    </MetricsContext.Provider>
  );
}

/**
 * Render the metrics for a given chat, if available
 * @param {metrics: {duration:number, outputTps: number, model: string, timestamp: number}} props
 * @returns
 */
export default function RenderMetrics({ metrics = {} }) {
  // Inherit the showMetricsAutomatically state from the MetricsProvider so the state is shared across all chats
  const { showMetricsAutomatically } = useContext(MetricsContext);
  const hasMetrics =
    !!metrics?.duration ||
    !!metrics?.outputTps ||
    !!metrics?.prompt_tokens ||
    !!metrics?.completion_tokens ||
    !!metrics?.total_tokens;
  // Mobile has no hover to reveal the line, so only render it there when the
  // user explicitly enabled the preference.
  if (!hasMetrics || (isMobile && !showMetricsAutomatically)) return null;

  return (
    <button
      type="button"
      onClick={() => setShowChatMetrics(!showMetricsAutomatically)}
      data-tooltip-id="metrics-visibility"
      data-tooltip-content={
        showMetricsAutomatically
          ? "Click to only show metrics when hovering"
          : "Click to show metrics as soon as they are available"
      }
      className={`border-none flex md:justify-end items-center gap-x-[8px] -ml-7 ${showMetricsAutomatically ? "opacity-100" : "opacity-0"} md:group-hover:opacity-100 transition-all duration-300`}
    >
      <p className="cursor-pointer text-xs font-mono text-zinc-400 light:text-slate-500">
        {buildMetricsString(metrics)}
      </p>
    </button>
  );
}
