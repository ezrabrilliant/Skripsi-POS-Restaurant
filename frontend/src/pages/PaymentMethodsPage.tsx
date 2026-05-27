// PaymentMethodsPage - REV 2.6 owner-only config metode pembayaran + bank.
// 2 tab di 1 page (segmented Tabs primitive) — konsisten dengan StockPage pattern.
// Akses: owner only (gate di RoleRoute). Cashier konsumsi PaymentModal /menu-only
// via paymentMethodService.list() yang tetap public-auth.

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CreditCard, Building2 } from 'lucide-react'
import { paymentMethodService } from '@/services/paymentMethodService'
import { bankService } from '@/services/bankService'
import PaymentMethodsTab from '@/components/payment-methods/PaymentMethodsTab'
import BanksTab from '@/components/payment-methods/BanksTab'
import { Tabs } from '@/design-system/primitives'

type Tab = 'methods' | 'banks'

export default function PaymentMethodsPage() {
  const [tab, setTab] = useState<Tab>('methods')

  // Owner liat semua (termasuk inactive) supaya bisa reactivate.
  const methodsQuery = useQuery({
    queryKey: ['paymentMethods', 'admin'],
    queryFn: () => paymentMethodService.list(true),
  })

  const banksQuery = useQuery({
    queryKey: ['banks', 'admin'],
    queryFn: () => bankService.list(true),
  })

  return (
    <div className="h-full flex flex-col">
      <header className="bg-white border-b border-neutral-200 px-3 sm:px-4 py-2.5 flex items-center gap-3 flex-wrap pt-safe md:pt-2.5">
        <div className="min-w-0">
          <h1 className="text-title font-semibold text-neutral-900">Pembayaran</h1>
          <p className="text-caption text-neutral-500">Konfigurasi metode pembayaran + bank</p>
        </div>
        <div className="ml-auto">
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as Tab)}
            items={[
              {
                value: 'methods',
                label: `Metode (${methodsQuery.data?.length ?? 0})`,
                icon: <CreditCard className="w-4 h-4" />,
              },
              {
                value: 'banks',
                label: `Bank (${banksQuery.data?.length ?? 0})`,
                icon: <Building2 className="w-4 h-4" />,
              },
            ]}
            variant="segmented"
          />
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'methods' ? (
          <PaymentMethodsTab
            methods={methodsQuery.data ?? []}
            banks={banksQuery.data ?? []}
            loading={methodsQuery.isLoading || banksQuery.isLoading}
          />
        ) : (
          <BanksTab banks={banksQuery.data ?? []} loading={banksQuery.isLoading} />
        )}
      </div>
    </div>
  )
}
