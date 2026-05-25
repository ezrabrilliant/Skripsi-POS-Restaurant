/**
 * Toast wrapper di atas react-hot-toast dengan semantic variant + icon +
 * styling konsisten dgn design tokens. Position top-center supaya tidak
 * tertutup bottom nav mobile + hormat safe-area-top.
 *
 * Konfigurasi Toaster (position, default style) tetap di main.tsx.
 * Hook ini hanya helper untuk konsisten panggil toast dgn variant.
 */

import { toast as raw } from 'react-hot-toast'
import type { Toast } from 'react-hot-toast'

type ToastOptions = Partial<Pick<Toast, 'id' | 'duration' | 'position' | 'icon'>>

export interface ToastApi {
  success: (message: string, opts?: ToastOptions) => string
  error: (message: string, opts?: ToastOptions) => string
  info: (message: string, opts?: ToastOptions) => string
  warning: (message: string, opts?: ToastOptions) => string
  loading: (message: string, opts?: ToastOptions) => string
  dismiss: (id?: string) => void
  promise: typeof raw.promise
}

export function useToast(): ToastApi {
  return {
    success: (msg, opts) => raw.success(msg, opts),
    error: (msg, opts) =>
      raw.error(msg, {
        duration: opts?.duration ?? 4500,
        ...opts,
      }),
    info: (msg, opts) =>
      raw(msg, {
        icon: 'ℹ️',
        ...opts,
      }),
    warning: (msg, opts) =>
      raw(msg, {
        icon: '⚠️',
        duration: opts?.duration ?? 4000,
        ...opts,
      }),
    loading: (msg, opts) => raw.loading(msg, opts),
    dismiss: (id) => raw.dismiss(id),
    promise: raw.promise,
  }
}
