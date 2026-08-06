import { useEffect, useRef, useState } from "react";

/**
 * Requests the Screen Wake Lock API to prevent the device screen from
 * dimming or locking while in Cook Mode.
 * Gracefully degrades on unsupported browsers (Safari < 16.4, older Android).
 * Re-acquires the lock when the page becomes visible again after a tab switch.
 */
export function useWakeLock() {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    let mounted = true;

    const request = async () => {
      if (!("wakeLock" in navigator)) return;
      try {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
        if (mounted) setIsActive(true);
        wakeLockRef.current.addEventListener("release", () => {
          if (mounted) setIsActive(false);
        });
      } catch {
        // Permission denied or API not available — fail silently
      }
    };

    request();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") request();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      mounted = false;
      wakeLockRef.current?.release().catch(() => {});
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return { isActive };
}
