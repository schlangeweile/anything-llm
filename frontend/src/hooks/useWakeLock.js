import { useEffect, useRef } from "react";
import Appearance from "@/models/appearance";

/**
 * R9(A): keep the screen awake while a reply is streaming.
 *
 * Opt-in via Appearance.keepScreenAwake (default false). The Wake Lock API
 * only exists in a secure context (HTTPS) and browsers release the lock when
 * the tab is hidden, so re-request on visibilitychange. A missing API or a
 * rejected request is a silent no-op - this is a convenience, never a
 * correctness condition.
 *
 * @param {boolean} active - true while a response is being generated
 */
export default function useWakeLock(active = false) {
  const lockRef = useRef(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    async function release() {
      const lock = lockRef.current;
      lockRef.current = null;
      if (!lock || lock.released) return;
      try {
        await lock.release();
      } catch {}
    }

    async function request() {
      if (!activeRef.current) return;
      if (!Appearance.get("keepScreenAwake")) return;
      if (document.visibilityState !== "visible") return;
      if (!("wakeLock" in navigator)) return;
      if (lockRef.current && !lockRef.current.released) return;
      try {
        const lock = await navigator.wakeLock.request("screen");
        lockRef.current = lock;
        lock.addEventListener?.("release", () => {
          if (lockRef.current === lock) lockRef.current = null;
        });
      } catch {
        // Not allowed / no secure context / unsupported: do nothing.
        lockRef.current = null;
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") request();
      else release();
    }

    if (active) request();
    else release();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      release();
    };
  }, [active]);
}
