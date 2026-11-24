import { create } from 'zustand';

export interface DialogAction {
  label: string;
  style?: 'default' | 'primary' | 'destructive' | 'cancel';
  onPress?: () => void;
}

export interface DialogRequest {
  title: string;
  message: string;
  actions?: DialogAction[];
}

interface DialogStoreState {
  current: DialogRequest | null;
  showDialog: (request: DialogRequest) => void;
  closeDialog: () => void;
}

/**
 * Cross-platform accessible dialog store.
 * Replaces `Alert.alert` (which is a no-op on react-native-web) so every
 * confirmation, error, and feedback prompt works reliably on Web, iOS, and Android.
 */
export const useDialogStore = create<DialogStoreState>((set) => ({
  current: null,
  showDialog: (request) => set({ current: request }),
  closeDialog: () => set({ current: null }),
}));

export function showAppDialog(request: DialogRequest): void {
  useDialogStore.getState().showDialog(request);
}
