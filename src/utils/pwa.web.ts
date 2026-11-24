export interface PwaInstallState {
  canPromptNativeInstall: boolean;
  isIosSafariInstallable: boolean;
  isStandalone: boolean;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let initialized = false;
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

/**
 * Registers the TileCraft offline Service Worker, injects PWA head tags during
 * local dev, and listens for Chrome/Edge/Android `beforeinstallprompt`.
 */
export function registerPwa(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  // Ensure PWA tags exist even in local `expo start --web` dev mode
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
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // Ignore registration errors in restricted non-HTTPS dev contexts
      });
    });
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
