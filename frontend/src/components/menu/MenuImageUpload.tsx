/**
 * MenuImageUpload - file picker untuk foto menu dengan auto-upload + preview.
 *
 * Owner pilih file (drag/click) → upload ke backend → backend convert ke WebP
 * via sharp → return imageUrl → preview muncul. Tidak ada input URL manual.
 *
 * Props:
 * - value: imageUrl saat ini (mis. "/menu/ayam-bakar.webp") atau null
 * - onChange: dipanggil dengan imageUrl baru setelah upload sukses, atau null saat dihapus
 * - name: nama menu - dipakai backend untuk slug filename
 * - disabled: optional, disable interaksi saat parent loading
 */

import { useRef, useState, type DragEvent, type ChangeEvent } from 'react'
import { Camera, ImagePlus, Loader2, X } from 'lucide-react'
import { Button } from '@/design-system/primitives/Button'
import { useToast } from '@/design-system/hooks/useToast'
import { menuService } from '@/services/menuService'
import { cn } from '@/lib/utils'

const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const ACCEPT = 'image/jpeg,image/jpg,image/png,image/webp,image/gif'

interface MenuImageUploadProps {
  value: string | null
  onChange: (url: string | null) => void
  name: string
  disabled?: boolean
}

export function MenuImageUpload({ value, onChange, name, disabled }: MenuImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const toast = useToast()

  const previewSrc = localPreview ?? value

  const handleFile = async (file: File) => {
    setErrorMsg(null)

    if (file.size > MAX_SIZE) {
      setErrorMsg('Ukuran file melebihi 5MB')
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setLocalPreview(objectUrl)
    setIsUploading(true)

    try {
      const { imageUrl } = await menuService.uploadImage(file, name || 'menu')
      onChange(imageUrl)
      toast.success('Foto berhasil diunggah')
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? // axios error - ambil pesan dari backend
            (err as { response?: { data?: { message?: string } } }).response?.data?.message ||
            'Gagal mengunggah foto'
          : 'Gagal mengunggah foto'
      setErrorMsg(msg)
      setLocalPreview(null)
    } finally {
      setIsUploading(false)
      URL.revokeObjectURL(objectUrl)
    }
  }

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = '' // reset supaya bisa upload file yang sama lagi
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (disabled || isUploading) return
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!disabled && !isUploading) setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const openPicker = () => {
    if (disabled || isUploading) return
    inputRef.current?.click()
  }

  const handleRemove = () => {
    if (disabled || isUploading) return
    setLocalPreview(null)
    setErrorMsg(null)
    onChange(null)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-label text-neutral-700">Foto Menu</label>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={handleInputChange}
        disabled={disabled || isUploading}
      />

      {previewSrc ? (
        <div className="relative w-full max-h-48 rounded-lg overflow-hidden border border-neutral-200 bg-neutral-50">
          <img
            src={previewSrc}
            alt="Preview foto menu"
            className="w-full h-48 object-cover"
          />
          {isUploading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-white animate-spin" aria-hidden />
            </div>
          )}
          {!isUploading && (
            <div className="absolute top-2 right-2 flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={openPicker}
                disabled={disabled}
                leftIcon={<Camera className="h-4 w-4" aria-hidden />}
              >
                Ganti
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={handleRemove}
                disabled={disabled}
                leftIcon={<X className="h-4 w-4" aria-hidden />}
                aria-label="Hapus foto"
              >
                Hapus
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={openPicker}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              openPicker()
            }
          }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            'w-full min-h-32 rounded-lg border-2 border-dashed transition-colors',
            'flex flex-col items-center justify-center gap-2 cursor-pointer p-4',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40',
            isDragging
              ? 'border-primary-500 bg-primary-50'
              : 'border-neutral-300 bg-neutral-50 hover:border-primary-400 hover:bg-neutral-100',
            (disabled || isUploading) && 'opacity-60 cursor-not-allowed',
          )}
          aria-disabled={disabled || isUploading}
        >
          {isUploading ? (
            <Loader2 className="h-6 w-6 text-primary-600 animate-spin" aria-hidden />
          ) : (
            <ImagePlus className="h-6 w-6 text-neutral-400" aria-hidden />
          )}
          <p className="text-body-sm font-medium text-neutral-700">
            {isUploading ? 'Mengunggah...' : 'Klik atau seret foto ke sini'}
          </p>
          <p className="text-caption text-neutral-500 text-center">
            JPG/PNG/WebP/GIF · max 5MB · otomatis dikonversi ke WebP
          </p>
        </div>
      )}

      {errorMsg && (
        <p className="text-caption text-danger-700" role="alert">
          {errorMsg}
        </p>
      )}
    </div>
  )
}
