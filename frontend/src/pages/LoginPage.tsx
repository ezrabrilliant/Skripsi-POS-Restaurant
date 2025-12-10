import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Lock, Delete } from 'lucide-react'
import { authService } from '@/services/authService'
import { useAuthStore } from '@/stores/authStore'

export default function LoginPage() {
  const [pin, setPin] = useState('')
  const navigate = useNavigate()
  const { login } = useAuthStore()
  
  const loginMutation = useMutation({
    mutationFn: (pin: string) => authService.login(pin),
    onSuccess: (data) => {
      login(data.user, data.token)
      toast.success(`Selamat datang, ${data.user.name}!`)
      navigate('/pos')
    },
    onError: () => {
      toast.error('PIN salah')
      setPin('')
    },
  })
  
  const handlePinInput = (digit: string) => {
    if (pin.length < 6) {
      const newPin = pin + digit
      setPin(newPin)
      
      if (newPin.length === 6) {
        loginMutation.mutate(newPin)
      }
    }
  }
  
  const handleDelete = () => {
    setPin(pin.slice(0, -1))
  }
  
  const handleClear = () => {
    setPin('')
  }
  
  return (
    <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-500 rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <span className="text-white font-bold text-2xl">P</span>
          </div>
          <h1 className="text-2xl font-bold text-neutral-800">POS Restaurant</h1>
          <p className="text-neutral-500 mt-1">Masukkan PIN untuk login</p>
        </div>
        
        {/* PIN Display */}
        <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
          <div className="flex justify-center gap-3 mb-6">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full transition-colors ${
                  i < pin.length ? 'bg-primary-500' : 'bg-neutral-200'
                }`}
              />
            ))}
          </div>
          
          {/* Keypad */}
          <div className="grid grid-cols-3 gap-3">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'delete'].map((key) => {
              if (key === 'clear') {
                return (
                  <button
                    key={key}
                    onClick={handleClear}
                    className="aspect-square rounded-xl bg-neutral-100 text-neutral-500 font-medium hover:bg-neutral-200 transition-colors text-sm"
                  >
                    Clear
                  </button>
                )
              }
              if (key === 'delete') {
                return (
                  <button
                    key={key}
                    onClick={handleDelete}
                    className="aspect-square rounded-xl bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition-colors flex items-center justify-center"
                  >
                    <Delete className="w-5 h-5" />
                  </button>
                )
              }
              return (
                <button
                  key={key}
                  onClick={() => handlePinInput(key)}
                  disabled={loginMutation.isPending}
                  className="aspect-square rounded-xl bg-neutral-50 text-neutral-800 text-xl font-semibold hover:bg-neutral-100 transition-colors disabled:opacity-50"
                >
                  {key}
                </button>
              )
            })}
          </div>
        </div>
        
        {/* Loading State */}
        {loginMutation.isPending && (
          <div className="text-center text-neutral-500">
            <Lock className="w-5 h-5 animate-pulse mx-auto mb-2" />
            <p>Memverifikasi...</p>
          </div>
        )}
        
        {/* Demo PINs */}
        <div className="text-center text-xs text-neutral-400 mt-6">
          <p>Demo PIN:</p>
          <p>Owner: 123456 | Kasir: 111111</p>
        </div>
      </div>
    </div>
  )
}
