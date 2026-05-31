// RestaurantIdentityTab - REV 2.12 owner-only identitas restoran.
// Dipakai di header struk (WS-C) + branding login/header. Konsisten dengan
// TaxSettingsTab/ShiftWindowTab (card + input + tombol Simpan).
// Logo di-upload via settingsService.uploadLogo (sharp -> WebP, folder /branding).

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Store, ImagePlus, Loader2, X } from 'lucide-react'
import { settingsService } from '@/services/settingsService'
import { Button, Input, Skeleton } from '@/design-system/primitives'
import { useToast } from '@/design-system/hooks/useToast'

export default function RestaurantIdentityTab() {
  const qc = useQueryClient()
  const toast = useToast()
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: settingsService.get })

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [hours, setHours] = useState('')
  const [phone, setPhone] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (settingsQuery.data) {
      setName(settingsQuery.data.restaurantName)
      setAddress(settingsQuery.data.restaurantAddress ?? '')
      setHours(settingsQuery.data.openingHours ?? '')
      setPhone(settingsQuery.data.restaurantPhone ?? '')
      setLogoUrl(settingsQuery.data.restaurantLogoUrl)
    }
  }, [settingsQuery.data])

  const saveMutation = useMutation({
    mutationFn: () =>
      settingsService.update({
        restaurantName: name.trim(),
        restaurantAddress: address.trim() || null,
        openingHours: hours.trim() || null,
        restaurantPhone: phone.trim() || null,
        restaurantLogoUrl: logoUrl,
      }),
    onSuccess: () => {
      toast.success('Identitas resto disimpan')
      qc.invalidateQueries({ queryKey: ['settings'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran file melebihi 5MB')
      return
    }
    setUploading(true)
    try {
      const { imageUrl } = await settingsService.uploadLogo(file)
      setLogoUrl(imageUrl)
      toast.success('Logo diunggah - klik Simpan untuk menyimpan')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengunggah logo')
    } finally {
      setUploading(false)
    }
  }

  const nameInvalid = name.trim().length === 0
  const dirty =
    !!settingsQuery.data &&
    (name.trim() !== settingsQuery.data.restaurantName ||
      (address.trim() || null) !== settingsQuery.data.restaurantAddress ||
      (hours.trim() || null) !== settingsQuery.data.openingHours ||
      (phone.trim() || null) !== settingsQuery.data.restaurantPhone ||
      logoUrl !== settingsQuery.data.restaurantLogoUrl)

  if (settingsQuery.isLoading) {
    return (
      <div className="p-3 sm:p-4 max-w-2xl mx-auto">
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="p-3 sm:p-4 space-y-3 max-w-2xl mx-auto">
      <div className="bg-white rounded-xl border border-neutral-200/60 p-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
            <Store size={20} className="text-neutral-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-neutral-900">Identitas Restoran</p>
            <p className="text-caption text-neutral-500">
              Dipakai di header struk + branding aplikasi. Pastikan sesuai data resmi.
            </p>
          </div>
        </div>

        {/* Logo */}
        <div className="space-y-1.5">
          <label className="text-body-sm font-medium text-neutral-700">Logo</label>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
              e.target.value = ''
            }}
          />
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-lg border border-neutral-200 bg-neutral-50 flex items-center justify-center overflow-hidden shrink-0">
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary-600" aria-hidden />
              ) : logoUrl ? (
                <img src={logoUrl} alt="Logo restoran" className="w-full h-full object-contain" />
              ) : (
                <ImagePlus className="h-5 w-5 text-neutral-400" aria-hidden />
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {logoUrl ? 'Ganti Logo' : 'Unggah Logo'}
              </Button>
              {logoUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setLogoUrl(null)}
                  leftIcon={<X className="h-4 w-4" aria-hidden />}
                >
                  Hapus
                </Button>
              )}
            </div>
          </div>
          <p className="text-caption text-neutral-500">JPG/PNG/WebP · max 5MB · disimpan sebagai WebP</p>
        </div>

        <Input
          label="Nama Restoran"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={nameInvalid ? 'Nama wajib diisi' : undefined}
          required
        />
        <Input
          label="Alamat"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Ir. Soekarno No. 221 unit GF, 221 Lane Merr, Surabaya"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Jam Buka"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="10.00 - 22.00"
          />
          <Input
            label="Telepon"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+62 877-3424-2941"
          />
        </div>

        <div className="flex justify-end pt-1">
          <Button
            variant="primary"
            size="md"
            onClick={() => saveMutation.mutate()}
            disabled={!dirty || nameInvalid || uploading || saveMutation.isPending}
            loading={saveMutation.isPending}
          >
            Simpan
          </Button>
        </div>
      </div>
    </div>
  )
}
