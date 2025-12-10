import { AlertTriangle, X } from 'lucide-react'
import type { MenuWithStock } from '@/types'

interface ForceOrderModalProps {
  isOpen: boolean
  menu: MenuWithStock | null
  onClose: () => void
  onConfirm: () => void
}

export default function ForceOrderModal({ isOpen, menu, onClose, onConfirm }: ForceOrderModalProps) {
  if (!isOpen || !menu) return null
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-600"
        >
          <X className="w-5 h-5" />
        </button>
        
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-warning-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-warning-600" />
          </div>
        </div>
        
        {/* Content */}
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold text-neutral-800 mb-2">
            Stok Habis!
          </h3>
          <p className="text-neutral-600 mb-4">
            <span className="font-medium">{menu.name}</span> sudah habis.
          </p>
          <p className="text-sm text-neutral-500">
            Ambil dari stok cadangan/rumah pemilik?
          </p>
          <p className="text-xs text-warning-600 mt-2">
            (Stok akan menjadi negatif: {menu.stockRemaining - 1})
          </p>
        </div>
        
        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-neutral-100 text-neutral-700 rounded-lg font-medium hover:bg-neutral-200 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 bg-warning-500 text-white rounded-lg font-medium hover:bg-warning-600 transition-colors"
          >
            Ya, Force Order
          </button>
        </div>
      </div>
    </div>
  )
}
