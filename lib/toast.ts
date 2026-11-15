export interface ToastData {
  message: string;
  actionText?: string;
  actionHref?: string;
  duration?: number;
}

export function showToast(message: string, actionText?: string, actionHref?: string, duration = 4500) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('ledgerwise-toast', {
      detail: { message, actionText, actionHref, duration },
    })
  );
}
