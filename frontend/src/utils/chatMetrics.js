import Appearance from "@/models/appearance";

// Legacy key used by the per-message metrics line before the preference
// existed. It is kept in sync so an already-pinned line stays pinned.
const LEGACY_KEY = "anythingllm_show_chat_metrics";
export const SHOW_METRICS_EVENT = "anythingllm_show_metrics_change";

/**
 * Whether the chat metrics line should be visible without hovering.
 * Migrates the legacy localStorage flag on first read.
 * @returns {boolean}
 */
export function getShowChatMetrics() {
  if (Appearance.get("showChatMetrics") === true) return true;
  try {
    return window.localStorage.getItem(LEGACY_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Persist the preference and notify an open chat so the line appears or
 * disappears immediately.
 * @param {boolean} value
 * @returns {boolean}
 */
export function setShowChatMetrics(value) {
  const enabled = !!value;
  Appearance.set("showChatMetrics", enabled);
  try {
    window.localStorage.setItem(LEGACY_KEY, enabled ? "true" : "false");
  } catch {}
  window.dispatchEvent(
    new CustomEvent(SHOW_METRICS_EVENT, {
      detail: { showMetricsAutomatically: enabled },
    })
  );
  return enabled;
}
