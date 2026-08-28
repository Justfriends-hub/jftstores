import { useEffect, useState } from "react";
import { X, Share } from "lucide-react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "jfs-install-banner-dismissed-at";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isMobile() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isPreviewOrIframe() {
  if (typeof window === "undefined") return true;
  try {
    if (window.self !== window.top) return true;
  } catch { return true; }
  const h = window.location.hostname;
  return h.includes("id-preview--") || h.includes("lovableproject.com");
}

function recentlyDismissed(daysMs: number): boolean {
  try {
    const ts = parseInt(localStorage.getItem(DISMISS_KEY) || "0", 10);
    return ts > 0 && Date.now() - ts < daysMs;
  } catch { return false; }
}

export function InstallBanner() {
  const [show, setShow] = useState(false);
  const [bip, setBip] = useState<BIPEvent | null>(null);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (isPreviewOrIframe() || !isMobile() || isStandalone()) return;
    const iosDevice = isIOS();
    setIos(iosDevice);

    if (iosDevice) {
      if (recentlyDismissed(24 * 60 * 60 * 1000)) return;
      // iOS has no beforeinstallprompt — show guided banner
      const t = setTimeout(() => setShow(true), 4000);
      return () => clearTimeout(t);
    }

    if (recentlyDismissed(3 * 24 * 60 * 60 * 1000)) return;
    const handler = (e: Event) => {
      e.preventDefault();
      setBip(e as BIPEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    setShow(false);
  }

  async function install() {
    if (!bip) return;
    await bip.prompt();
    const { outcome } = await bip.userChoice;
    if (outcome) dismiss();
  }

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 sm:px-6">
      <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card/95 backdrop-blur shadow-lg p-3 sm:p-4 flex items-center gap-3 animate-in slide-in-from-bottom duration-300">
        <div className="text-2xl">📲</div>
        <div className="flex-1 min-w-0 text-sm">
          {ios ? (
            <>
              <p className="font-medium">Add JFT STORES — MARKETPLACE to your home screen</p>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                Tap <Share className="inline h-3 w-3" /> then "Add to Home Screen" to get deal alerts.
              </p>
            </>
          ) : (
            <>
              <p className="font-medium">Add JFT STORES — MARKETPLACE to your home screen</p>
              <p className="text-xs text-muted-foreground mt-0.5">Get notified when your favourite stores post new deals.</p>
            </>
          )}
        </div>
        {!ios && bip && (
          <button onClick={install} className="rounded-full bg-primary text-primary-foreground text-xs font-medium px-3 py-1.5 whitespace-nowrap">
            Download
          </button>
        )}
        <button onClick={dismiss} aria-label="Dismiss" className="h-7 w-7 grid place-items-center rounded-full hover:bg-muted">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
