export interface PwaInstallState {
  canPromptNativeInstall: boolean;
  isIosSafariInstallable: boolean;
  isStandalone: boolean;
  isOfflineReady: boolean;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let initialized = false;
let offlineReady = false;
const listeners = new Set<(state: PwaInstallState) => void>();

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    nav.standalone === true
  );
}

function detectIosSafari(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return isIos && isSafari;
}

function getCurrentState(): PwaInstallState {
  const isStandalone = detectStandalone();
  return {
    canPromptNativeInstall: !isStandalone && deferredPrompt !== null,
    isIosSafariInstallable: !isStandalone && detectIosSafari(),
    isStandalone,
    isOfflineReady: offlineReady,
  };
}

function emitState(): void {
  const snapshot = getCurrentState();
  listeners.forEach((fn) => fn(snapshot));
}

function ensureHeadTag(selector: string, create: () => HTMLElement): void {
  if (typeof document === 'undefined') return;
  if (!document.head.querySelector(selector)) {
    document.head.appendChild(create());
  }
}

function injectAccessibleFocusStyles(): void {
  ensureHeadTag('style#tilecraft-a11y-focus', () => {
    const style = document.createElement('style');
    style.id = 'tilecraft-a11y-focus';
    style.textContent = `
      [role="button"]:focus-visible,
      [role="link"]:focus-visible,
      [tabindex]:focus-visible,
      button:focus-visible,
      a:focus-visible,
      input:focus-visible {
        outline: 2.5px solid #F59E0B !important;
        outline-offset: 2px !important;
      }
    `;
    return style;
  });
}

/**
 * Registers the TileCraft offline Service Worker immediately (fixing the bug where
 * attaching a `load` listener inside React's `useEffect` missed an already-fired load event),
 * injects visible keyboard focus styles, and handles Chrome/Android install prompts.
 */
export function registerPwa(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  injectAccessibleFocusStyles();

  ensureHeadTag('link[rel="manifest"]', () => {
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = '/manifest.json';
    return link;
  });

  ensureHeadTag('meta[name="theme-color"]', () => {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = '#0F131D';
    return meta;
  });

  ensureHeadTag('link[rel="apple-touch-icon"]', () => {
    const link = document.createElement('link');
    link.rel = 'apple-touch-icon';
    link.href = '/apple-touch-icon.png';
    return link;
  });

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    emitState();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    emitState();
  });

  if ('serviceWorker' in navigator) {
    const doRegister = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          if (registration.active || navigator.serviceWorker.controller) {
            offlineReady = true;
            emitState();
          }

          const watchWorker = (worker: ServiceWorker | null) => {
            if (!worker) return;
            worker.addEventListener('statechange', () => {
              if (worker.state === 'activated') {
                offlineReady = true;
                emitState();
              }
            });
          };

          watchWorker(registration.installing);
          watchWorker(registration.waiting);
          registration.addEventListener('updatefound', () => {
            watchWorker(registration.installing);
          });
        })
        .catch(() => {
          // Ignore SW registration errors on insecure non-localhost origins
        });
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      doRegister();
    } else {
      window.addEventListener('load', doRegister, { once: true });
    }
  }
}

export function subscribePwaInstallState(
  listener: (state: PwaInstallState) => void
): () => void {
  listeners.add(listener);
  listener(getCurrentState());
  return () => {
    listeners.delete(listener);
  };
}

export async function triggerPwaInstallPrompt(): Promise<boolean> {
  if (!deferredPrompt) return false;
  await deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  if (choice.outcome === 'accepted') {
    deferredPrompt = null;
    emitState();
    return true;
  }
  return false;
}
