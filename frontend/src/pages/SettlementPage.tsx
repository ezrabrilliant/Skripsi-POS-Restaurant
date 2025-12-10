import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Calculator, Check, AlertTriangle } from 'lucide-react'
import { settlementService } from '@/services/settlementService'
import { formatCurrency, getTodayDate } from '@/lib/utils'

export default function SettlementPage() {
  const [selectedDate, setSelectedDate] = useState(getTodayDate())
  const [actualCash, setActualCash] = useState<string>('')
  const [actualEdc, setActualEdc] = useState<string>('')
  const [actualTransfer, setActualTransfer] = useState<string>('')
  const [varianceReason, setVarianceReason] = useState('')
  const [notes, setNotes] = useState('')
  
  const queryClient = useQueryClient()
  
  // Fetch system totals
  const { data: systemTotals, isLoading: loadingSystem } = useQuery({
    queryKey: ['systemTotals', selectedDate],
    queryFn: () => settlementService.calculateSystemTotals(selectedDate),
  })
  
  // Fetch existing settlement
  const { data: existingSettlement } = useQuery({
    queryKey: ['settlement', selectedDate],
    queryFn: () => settlementService.getSettlementByDate(selectedDate),
  })
  
  // Load existing settlement data
  useEffect(() => {
    if (existingSettlement) {
      setActualCash(String(existingSettlement.actualCash))
      setActualEdc(String(existingSettlement.actualEdc))
      setActualTransfer(String(existingSettlement.actualTransfer))
      setVarianceReason(existingSettlement.varianceReason || '')
      setNotes(existingSettlement.notes || '')
    } else {
      // Pre-fill with system totals
      if (systemTotals) {
        setActualCash(String(systemTotals.systemCash))
        setActualEdc(String(systemTotals.systemEdc))
        setActualTransfer(String(systemTotals.systemTransfer))
      }
    }
  }, [existingSettlement, systemTotals])
  
  // Submit settlement mutation
  const submitMutation = useMutation({
    mutationFn: () => settlementService.createSettlement({
      date: selectedDate,
      actualCash: Number(actualCash) || 0,
      actualEdc: Number(actualEdc) || 0,
      actualTransfer: Number(actualTransfer) || 0,
      varianceReason: varianceReason || undefined,
      notes: notes || undefined,
    }),
    onSuccess: () => {
      toast.success('Settlement berhasil disimpan')
      queryClient.invalidateQueries({ queryKey: ['settlement'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Gagal menyimpan settlement')
    },
  })
  
  // Calculate variance
  const actualTotal = (Number(actualCash) || 0) + (Number(actualEdc) || 0) + (Number(actualTransfer) || 0)
  const systemTotal = systemTotals?.systemTotal || 0
  const variance = actualTotal - systemTotal
  const hasVariance = variance !== 0
  
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-neutral-800">Tutup Kasir</h1>
            <p className="text-neutral-500">Settlement harian</p>
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2 bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        
        {/* Status Badge */}
        {existingSettlement && (
          <div className={`mb-6 p-4 rounded-lg ${
            existingSettlement.status === 'reviewed' 
              ? 'bg-success-50 border border-success-200' 
              : 'bg-warning-50 border border-warning-200'
          }`}>
            <div className="flex items-center gap-2">
              <Check className={`w-5 h-5 ${
                existingSettlement.status === 'reviewed' ? 'text-success-600' : 'text-warning-600'
              }`} />
              <span className={`font-medium ${
                existingSettlement.status === 'reviewed' ? 'text-success-700' : 'text-warning-700'
              }`}>
                {existingSettlement.status === 'reviewed' ? 'Sudah direview' : 'Sudah disubmit'}
              </span>
            </div>
          </div>
        )}
        
        {/* System Summary */}
        <div className="bg-white rounded-xl p-6 mb-6 shadow-sm">
          <h2 className="font-semibold text-neutral-800 mb-4 flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Data Sistem
          </h2>
          
          {loadingSystem ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-6 bg-neutral-200 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-neutral-500">Jumlah Transaksi</span>
                <span className="font-medium">{systemTotals?.transactionCount || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Tunai</span>
                <span className="font-medium">{formatCurrency(systemTotals?.systemCash || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">EDC / QRIS</span>
                <span className="font-medium">{formatCurrency(systemTotals?.systemEdc || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Transfer</span>
                <span className="font-medium">{formatCurrency(systemTotals?.systemTransfer || 0)}</span>
              </div>
              <div className="flex justify-between pt-3 border-t border-neutral-200">
                <span className="font-semibold">Total Sistem</span>
                <span className="font-bold text-primary-600">{formatCurrency(systemTotal)}</span>
              </div>
            </div>
          )}
        </div>
        
        {/* Actual Input */}
        <div className="bg-white rounded-xl p-6 mb-6 shadow-sm">
          <h2 className="font-semibold text-neutral-800 mb-4">Input Aktual</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-neutral-600 mb-1">Tunai Aktual</label>
              <input
                type="number"
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
                className="w-full px-4 py-2 bg-neutral-100 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-600 mb-1">EDC / QRIS Aktual</label>
              <input
                type="number"
                value={actualEdc}
                onChange={(e) => setActualEdc(e.target.value)}
                className="w-full px-4 py-2 bg-neutral-100 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-600 mb-1">Transfer Aktual</label>
              <input
                type="number"
                value={actualTransfer}
                onChange={(e) => setActualTransfer(e.target.value)}
                className="w-full px-4 py-2 bg-neutral-100 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="0"
              />
            </div>
            
            <div className="flex justify-between pt-3 border-t border-neutral-200">
              <span className="font-semibold">Total Aktual</span>
              <span className="font-bold">{formatCurrency(actualTotal)}</span>
            </div>
          </div>
        </div>
        
        {/* Variance */}
        {hasVariance && (
          <div className={`rounded-xl p-6 mb-6 ${
            variance > 0 ? 'bg-success-50' : 'bg-danger-50'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className={`w-5 h-5 ${
                variance > 0 ? 'text-success-600' : 'text-danger-600'
              }`} />
              <span className={`font-semibold ${
                variance > 0 ? 'text-success-700' : 'text-danger-700'
              }`}>
                Selisih: {formatCurrency(Math.abs(variance))} ({variance > 0 ? 'Lebih' : 'Kurang'})
              </span>
            </div>
            
            <div>
              <label className="block text-sm text-neutral-600 mb-1">
                Alasan Selisih (wajib diisi)
              </label>
              <textarea
                value={varianceReason}
                onChange={(e) => setVarianceReason(e.target.value)}
                className="w-full px-4 py-2 bg-white rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary-500"
                rows={2}
                placeholder="Jelaskan alasan selisih..."
              />
            </div>
          </div>
        )}
        
        {/* Notes */}
        <div className="bg-white rounded-xl p-6 mb-6 shadow-sm">
          <label className="block text-sm text-neutral-600 mb-1">Catatan (opsional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-4 py-2 bg-neutral-100 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary-500"
            rows={2}
            placeholder="Catatan tambahan..."
          />
        </div>
        
        {/* Submit Button */}
        <button
          onClick={() => submitMutation.mutate()}
          disabled={submitMutation.isPending || (hasVariance && !varianceReason)}
          className="w-full px-4 py-3 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitMutation.isPending ? 'Menyimpan...' : 'Submit Settlement'}
        </button>
      </div>
    </div>
  )
}
