import { useEffect, useState, useCallback } from "react";

export type OnboardingType = "shopper" | "seller";

const KEYS = {
  shopper: "onboarding.shopper.v2",
  seller: "onboarding.seller.v2",
} as const;

export function useOnboarding(type: OnboardingType) {
  const [completed, setCompleted] = useState<boolean>(true); // default true to avoid flash
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(KEYS[type]);
      setCompleted(v === "1");
    } catch { setCompleted(false); }
    setReady(true);
  }, [type]);

  const complete = useCallback(() => {
    try { localStorage.setItem(KEYS[type], "1"); } catch {}
    setCompleted(true);
  }, [type]);

  const reset = useCallback(() => {
    try { localStorage.removeItem(KEYS[type]); } catch {}
    setCompleted(false);
  }, [type]);

  const shouldShow = ready && !completed;

  return { completed, ready, shouldShow, complete, reset };
}

export function resetAllOnboarding() {
  try {
    localStorage.removeItem(KEYS.shopper);
    localStorage.removeItem(KEYS.seller);
  } catch {}
}
