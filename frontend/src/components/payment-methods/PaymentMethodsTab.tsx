// PaymentMethodsTab - stub (Task 11.3 fills implementation).
// Wired up so Task 11.2 scaffold typechecks; full UI implemented in next commit.

import type { PaymentMethodView, BankView } from '@/types'
import { Skeleton } from '@/design-system/primitives'

interface Props {
  methods: PaymentMethodView[]
  banks: BankView[]
  loading: boolean
}

export default function PaymentMethodsTab({ loading }: Props) {
  if (loading) return <div className="p-3 sm:p-4"><Skeleton className="h-64" /></div>
  return <div className="p-3 sm:p-4 text-body-sm text-neutral-500">Coming soon (Task 11.3)</div>
}
