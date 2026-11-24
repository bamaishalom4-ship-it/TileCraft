export interface PwaInstallState {
  canPromptNativeInstall: boolean;
  isIosSafariInstallable: boolean;
  isStandalone: boolean;
}

/**
 * Native iOS/Android no-op implementation.
 * On Web, Metro resolves `pwa.web.ts` automatically.
 */
export function registerPwa(): void {
  // No-op on native mobile apps
}

export function subscribePwaInstallState(
  listener: (state: PwaInstallState) => void
): () => void {
  listener({
    canPromptNativeInstall: false,
    isIosSafariInstallable: false,
    isStandalone: true,
  });
  return () => {};
}

export async function triggerPwaInstallPrompt(): Promise<boolean> {
  return false;
}
