// MenuPage.tsx — host "Katalog Menu" (REV UX elevation).
// PageHeader + Tabs (Menu Jual / Varian SKU). Memegang query bersama
// (key ['menus','admin',showInactive] — SAMA dgn MenuFormModal supaya cache
// konsisten) + showInactive + routing tab via ?tab + focusMenuId.
import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { menuService } from '@/services/menuService'
import { PageHeader } from '@/design-system/primitives'
import { MenuJualTab } from '@/components/menu/MenuJualTab'
import { VarianSkuTab } from '@/components/menu/VarianSkuTab'

export default function MenuPage() {
  const [showInactive, setShowInactive] = useState(false)
  const [params, setParams] = useSearchParams()

  const { data: menus = [], isLoading } = useQuery({
    // includeHidden TETAP true (owner token bikin backend kirim cost) supaya
    // cache konsisten dengan MenuFormModal. SKU posVisible=false ditampilkan di
    // tab "Varian SKU"; menu jual (posVisible=true) di tab "Menu Jual".
    queryKey: ['menus', 'admin', showInactive],
    queryFn: () => menuService.list({ activeOnly: !showInactive, includeStock: true, includeHidden: true }),
  })

  const focusMenuId = params.get('focusMenuId') ? Number(params.get('focusMenuId')) : null
  const explicitTab = params.get('tab')

  const resolvedTab: 'jual' | 'varian' =
    explicitTab === 'varian'
      ? 'varian'
      : explicitTab === 'jual'
        ? 'jual'
        : focusMenuId != null
          ? menus.find((m) => m.id === focusMenuId)?.posVisible === false
            ? 'varian'
            : 'jual'
          : 'jual'

  const setTab = (t: 'jual' | 'varian') =>
    setParams(
      (prev) => {
        const n = new URLSearchParams(prev)
        n.set('tab', t)
        n.delete('focusMenuId')
        return n
      },
      { replace: true },
    )

  const clearFocus = useCallback(
    () =>
      setParams(
        (prev) => {
          const n = new URLSearchParams(prev)
          n.delete('focusMenuId')
          return n
        },
        { replace: true },
      ),
    [setParams],
  )

  const menuJualCount = useMemo(() => menus.filter((m) => m.posVisible).length, [menus])
  const varianCount = useMemo(() => menus.filter((m) => !m.posVisible).length, [menus])

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Katalog Menu"
        subtitle={`${menuJualCount} menu jual · ${varianCount} varian SKU`}
        tabs={{
          value: resolvedTab,
          onValueChange: (v) => setTab(v as 'jual' | 'varian'),
          items: [
            { value: 'jual', label: 'Menu Jual' },
            { value: 'varian', label: 'Varian SKU' },
          ],
        }}
      />

      <div className="flex-1 min-h-0 overflow-y-auto">
        {resolvedTab === 'jual' ? (
          <MenuJualTab
            menus={menus}
            isLoading={isLoading}
            showInactive={showInactive}
            onShowInactiveChange={setShowInactive}
            focusMenuId={resolvedTab === 'jual' ? focusMenuId : null}
            clearFocus={clearFocus}
          />
        ) : (
          <VarianSkuTab
            menus={menus}
            isLoading={isLoading}
            showInactive={showInactive}
            onShowInactiveChange={setShowInactive}
            focusMenuId={resolvedTab === 'varian' ? focusMenuId : null}
            clearFocus={clearFocus}
          />
        )}
      </div>
    </div>
  )
}
