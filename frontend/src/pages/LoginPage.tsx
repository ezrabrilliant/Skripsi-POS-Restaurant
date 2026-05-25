// REV 2.3.1 LoginPage — 2 mode:
//   (A) Cached mode: nama pegawai terakhir disimpan di localStorage. Tampilan
//       welcome "Halo, [Nama]" + numpad PIN 6 digit langsung. "Ganti Pengguna"
//       link reset ke fresh mode.
//   (B) Fresh mode: form 2 field nama + PIN (untuk first time atau setelah
//       ganti pengguna).
//
// Numpad: tactile mobile-first — pegawai pakai HP. Tombol min 56×56 (jauh di
// atas 44px min touch target).

import { useState, useRef, useEffect, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { LogIn, ArrowLeft, User as UserIcon, Delete } from 'lucide-react'
import { authService } from '@/services/authService'
import { useAuthStore } from '@/stores/authStore'
import { Button, Input } from '@/design-system/primitives'
import { useToast } from '@/design-system/hooks/useToast'
import { fadeIn, slideUpFade } from '@/design-system/motion'
import { cn } from '@/lib/utils'

export default function LoginPage() {
  const { lastUserName, login, clearLastUserName } = useAuthStore()
  const isCachedMode = lastUserName !== null
  const [forceFreshMode, setForceFreshMode] = useState(false)
  const showFresh = forceFreshMode || !isCachedMode
  const toast = useToast()

  const [name, setName] = useState(lastUserName ?? '')
  const [pin, setPin] = useState('')
  const navigate = useNavigate()
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (showFresh) {
      nameInputRef.current?.focus()
    }
  }, [showFresh])

  const loginMutation = useMutation({
    mutationFn: authService.login,
    onSuccess: (data) => {
      login(data.user, data.token)
      toast.success(`Selamat datang, ${data.user.name}!`)
      navigate('/')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Nama atau PIN salah')
      setPin('')
    },
  })

  const submitLogin = (submitName: string, submitPin: string) => {
    if (submitName.trim().length === 0) {
      toast.error('Nama pengguna wajib diisi')
      nameInputRef.current?.focus()
      return
    }
    if (submitPin.length !== 6) {
      toast.error('PIN harus 6 digit angka')
      return
    }
    loginMutation.mutate({ name: submitName.trim(), pin: submitPin })
  }

  const handleSubmitFresh = (e: FormEvent) => {
    e.preventDefault()
    submitLogin(name, pin)
  }

  const handlePinKey = (digit: string) => {
    if (loginMutation.isPending) return
    if (pin.length < 6) {
      const next = pin + digit
      setPin(next)
      if (next.length === 6 && isCachedMode && !forceFreshMode) {
        submitLogin(lastUserName!, next)
      }
    }
  }

  const handlePinBackspace = () => {
    if (loginMutation.isPending) return
    setPin(pin.slice(0, -1))
  }

  const handlePinClear = () => {
    if (loginMutation.isPending) return
    setPin('')
  }

  const handleGantiPengguna = () => {
    setForceFreshMode(true)
    clearLastUserName()
    setName('')
    setPin('')
    setTimeout(() => nameInputRef.current?.focus(), 50)
  }

  const isLoading = loginMutation.isPending

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-primary-50 via-neutral-50 to-neutral-100 flex items-center justify-center px-4 pt-safe pb-safe">
      <motion.div
        variants={slideUpFade}
        initial="initial"
        animate="animate"
        className="w-full max-w-sm"
      >
        {/* Brand header */}
        <motion.div
          variants={fadeIn}
          initial="initial"
          animate="animate"
          className="text-center mb-6"
        >
          <div className="w-16 h-16 bg-primary-600 rounded-2xl mx-auto mb-3 flex items-center justify-center shadow-md">
            <span className="text-white font-bold text-xl tracking-tight">ABM</span>
          </div>
          <h1 className="text-title font-semibold text-neutral-900 leading-tight">
            POS Ayam Bakar
          </h1>
          <p className="text-body-sm text-neutral-600 mt-0.5">Banjar Monosuko</p>
        </motion.div>

        {!showFresh && (
          <CachedModeView
            name={lastUserName!}
            pin={pin}
            isLoading={isLoading}
            onKey={handlePinKey}
            onBackspace={handlePinBackspace}
            onClear={handlePinClear}
            onGantiPengguna={handleGantiPengguna}
          />
        )}

        {showFresh && (
          <FreshModeView
            name={name}
            setName={setName}
            pin={pin}
            onKey={handlePinKey}
            onBackspace={handlePinBackspace}
            onClear={handlePinClear}
            onSubmit={handleSubmitFresh}
            isLoading={isLoading}
            nameInputRef={nameInputRef}
            showBackToCached={isCachedMode && forceFreshMode}
            onBackToCached={() => {
              setForceFreshMode(false)
              setName(lastUserName ?? '')
              setPin('')
            }}
          />
        )}

        <p className="text-center text-caption text-neutral-500 mt-4">
          Skripsi · Ezra Brilliant (C14220315)
        </p>
      </motion.div>
    </div>
  )
}

// ============================================================
// Mode A: Cached (PIN-only)
// ============================================================

interface CachedModeProps {
  name: string
  pin: string
  isLoading: boolean
  onKey: (digit: string) => void
  onBackspace: () => void
  onClear: () => void
  onGantiPengguna: () => void
}

function CachedModeView({
  name,
  pin,
  isLoading,
  onKey,
  onBackspace,
  onClear,
  onGantiPengguna,
}: CachedModeProps) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-md border border-neutral-200/60">
      <div className="flex items-center gap-3 bg-primary-50/70 rounded-xl p-3 mb-5">
        <div className="w-11 h-11 bg-primary-600 text-white rounded-full flex items-center justify-center font-semibold flex-shrink-0 text-lg tabular-nums">
          {name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-caption text-neutral-500">Login sebagai</p>
          <p className="text-body font-semibold text-neutral-900 truncate">{name}</p>
        </div>
        <button
          onClick={onGantiPengguna}
          disabled={isLoading}
          className="text-body-sm text-primary-700 hover:text-primary-800 hover:underline px-2 py-1 rounded disabled:opacity-50 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
        >
          Ganti
        </button>
      </div>

      <p className="text-center text-body-sm text-neutral-600 mb-3">
        Masukkan PIN 6 digit
      </p>
      <PinDots pin={pin} isLoading={isLoading} />

      <NumpadKeypad
        onKey={onKey}
        onBackspace={onBackspace}
        onClear={onClear}
        disabled={isLoading}
      />

      {isLoading && (
        <div className="mt-4 text-center text-body-sm text-neutral-500">
          Memverifikasi…
        </div>
      )}
    </div>
  )
}

// ============================================================
// Mode B: Fresh (2-field form)
// ============================================================

interface FreshModeProps {
  name: string
  setName: (v: string) => void
  pin: string
  onKey: (digit: string) => void
  onBackspace: () => void
  onClear: () => void
  onSubmit: (e: FormEvent) => void
  isLoading: boolean
  nameInputRef: React.RefObject<HTMLInputElement>
  showBackToCached: boolean
  onBackToCached: () => void
}

function FreshModeView({
  name,
  setName,
  pin,
  onKey,
  onBackspace,
  onClear,
  onSubmit,
  isLoading,
  nameInputRef,
  showBackToCached,
  onBackToCached,
}: FreshModeProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="bg-white rounded-2xl p-5 shadow-md border border-neutral-200/60 space-y-4"
    >
      {showBackToCached && (
        <button
          type="button"
          onClick={onBackToCached}
          className="inline-flex items-center gap-1.5 text-body-sm text-neutral-600 hover:text-neutral-900 px-1 py-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke pengguna terakhir
        </button>
      )}

      <Input
        ref={nameInputRef}
        label="Nama Pengguna"
        leftIcon={<UserIcon />}
        type="text"
        name="name"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={isLoading}
        maxLength={100}
        placeholder="Mis. Jason"
      />

      <div>
        <p className="text-label text-neutral-700 mb-2">PIN (6 digit)</p>
        <PinDots pin={pin} isLoading={isLoading} />
        <NumpadKeypad
          onKey={onKey}
          onBackspace={onBackspace}
          onClear={onClear}
          disabled={isLoading}
        />
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        loading={isLoading}
        leftIcon={<LogIn className="w-4 h-4" />}
        disabled={name.trim().length === 0 || pin.length !== 6}
      >
        {isLoading ? 'Memverifikasi…' : 'Masuk'}
      </Button>
    </form>
  )
}

// ============================================================
// Shared components
// ============================================================

function PinDots({ pin, isLoading }: { pin: string; isLoading: boolean }) {
  return (
    <div className="flex justify-center gap-2.5 mb-4">
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const filled = i < pin.length
        return (
          <motion.div
            key={i}
            initial={false}
            animate={{
              scale: filled ? 1 : 0.85,
              backgroundColor: filled
                ? isLoading
                  ? '#87d0a5'
                  : '#1f7a4d'
                : '#e8ece9',
            }}
            transition={{ duration: 0.12, ease: [0.2, 0, 0, 1] }}
            className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full"
          />
        )
      })}
    </div>
  )
}

function NumpadKeypad({
  onKey,
  onBackspace,
  onClear,
  disabled,
}: {
  onKey: (digit: string) => void
  onBackspace: () => void
  onClear: () => void
  disabled: boolean
}) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
        <NumpadButton key={d} disabled={disabled} onClick={() => onKey(d)} label={`Tombol ${d}`}>
          {d}
        </NumpadButton>
      ))}
      <NumpadButton variant="utility" disabled={disabled} onClick={onClear} label="Hapus semua PIN">
        Clear
      </NumpadButton>
      <NumpadButton disabled={disabled} onClick={() => onKey('0')} label="Tombol 0">
        0
      </NumpadButton>
      <NumpadButton variant="utility" disabled={disabled} onClick={onBackspace} label="Hapus 1 digit">
        <Delete className="w-5 h-5" />
      </NumpadButton>
    </div>
  )
}

function NumpadButton({
  children,
  onClick,
  disabled,
  variant = 'digit',
  label,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  variant?: 'digit' | 'utility'
  label: string
}) {
  const isDigit = variant === 'digit'
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      whileTap={{ scale: 0.94 }}
      transition={{ duration: 0.08 }}
      className={cn(
        'aspect-square rounded-xl font-semibold flex items-center justify-center select-none',
        'transition-colors duration-fast',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        isDigit
          ? 'bg-neutral-50 text-neutral-900 text-2xl hover:bg-neutral-100 active:bg-neutral-200 border border-neutral-200'
          : 'bg-neutral-100 text-neutral-600 text-body-sm hover:bg-neutral-200 active:bg-neutral-300'
      )}
    >
      {children}
    </motion.button>
  )
}
