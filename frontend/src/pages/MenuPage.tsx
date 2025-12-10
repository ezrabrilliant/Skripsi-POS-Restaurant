import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, X, Save } from 'lucide-react'
import { menuService } from '@/services'
import { formatCurrency } from '@/lib/utils'
import { MenuWithStock } from '@/types'

type MenuFormData = {
  name: string
  category: string
  price: number
  defaultStock: number
  isActive: boolean
}

const initialFormData: MenuFormData = {
  name: '',
  category: '',
  price: 0,
  defaultStock: 10,
  isActive: true,
}

const CATEGORIES = [
  'Makanan Utama',
  'Lauk',
  'Sayur',
  'Minuman',
  'Snack',
  'Tambahan',
]

export default function MenuPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingMenu, setEditingMenu] = useState<MenuWithStock | null>(null)
  const [formData, setFormData] = useState<MenuFormData>(initialFormData)
  const [filterCategory, setFilterCategory] = useState<string>('')
  
  const queryClient = useQueryClient()
  
  // Fetch menu
  const { data: menuItems = [], isLoading } = useQuery<MenuWithStock[]>({
    queryKey: ['menu'],
    queryFn: menuService.getAllMenu,
  })
  
  // Create mutation
  const createMutation = useMutation({
    mutationFn: menuService.createMenu,
    onSuccess: () => {
      toast.success('Menu berhasil ditambahkan')
      queryClient.invalidateQueries({ queryKey: ['menu'] })
      closeModal()
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
  
  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: Partial<MenuFormData> }) =>
      menuService.updateMenu(id, data),
    onSuccess: () => {
      toast.success('Menu berhasil diupdate')
      queryClient.invalidateQueries({ queryKey: ['menu'] })
      closeModal()
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
  
  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: menuService.deleteMenu,
    onSuccess: () => {
      toast.success('Menu berhasil dihapus')
      queryClient.invalidateQueries({ queryKey: ['menu'] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
  
  const openCreateModal = () => {
    setEditingMenu(null)
    setFormData(initialFormData)
    setIsModalOpen(true)
  }
  
  const openEditModal = (menu: MenuWithStock) => {
    setEditingMenu(menu)
    setFormData({
      name: menu.name,
      category: menu.category,
      price: menu.price,
      defaultStock: menu.stockStart || 10,
      isActive: menu.isActive,
    })
    setIsModalOpen(true)
  }
  
  const closeModal = () => {
    setIsModalOpen(false)
    setEditingMenu(null)
    setFormData(initialFormData)
  }
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingMenu) {
      updateMutation.mutate({ id: editingMenu.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }
  
  const handleDelete = (id: string, name: string) => {
    if (confirm(`Hapus menu "${name}"?`)) {
      deleteMutation.mutate(id)
    }
  }
  
  // Filter menu
  const filteredMenu = filterCategory
    ? menuItems.filter((m) => m.category === filterCategory)
    : menuItems
  
  // Group by category
  const categories = [...new Set(menuItems.map((m) => m.category))]
  
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-neutral-800">Manajemen Menu</h1>
            <p className="text-neutral-500">Tambah, edit, atau hapus menu</p>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
          >
            <Plus className="w-5 h-5" />
            Tambah Menu
          </button>
        </div>
        
        {/* Filter */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setFilterCategory('')}
            className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
              filterCategory === ''
                ? 'bg-primary-500 text-white'
                : 'bg-white text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            Semua
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                filterCategory === cat
                  ? 'bg-primary-500 text-white'
                  : 'bg-white text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        
        {/* Menu List */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-24 bg-neutral-200 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredMenu.map((menu: Menu) => (
              <div
                key={menu.id}
                className={`bg-white rounded-lg p-4 flex items-center justify-between ${
                  !menu.isActive ? 'opacity-50' : ''
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-neutral-800">{menu.name}</p>
                    {!menu.isActive && (
                      <span className="px-2 py-0.5 bg-neutral-200 text-neutral-600 text-xs rounded">
                        Nonaktif
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-neutral-500">{menu.category}</p>
                  <p className="text-primary-600 font-semibold">{formatCurrency(menu.price)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(menu)}
                    className="p-2 bg-neutral-100 rounded-lg hover:bg-neutral-200"
                  >
                    <Pencil className="w-4 h-4 text-neutral-600" />
                  </button>
                  <button
                    onClick={() => handleDelete(menu.id, menu.name)}
                    className="p-2 bg-danger-50 rounded-lg hover:bg-danger-100"
                  >
                    <Trash2 className="w-4 h-4 text-danger-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold">
                  {editingMenu ? 'Edit Menu' : 'Tambah Menu Baru'}
                </h2>
                <button onClick={closeModal} className="p-2 hover:bg-neutral-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm text-neutral-600 mb-1">Nama Menu</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 bg-neutral-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-neutral-600 mb-1">Kategori</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 bg-neutral-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  >
                    <option value="">Pilih Kategori</option>
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm text-neutral-600 mb-1">Harga</label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                    className="w-full px-4 py-2 bg-neutral-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                    min="0"
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-neutral-600 mb-1">Stok Default Harian</label>
                  <input
                    type="number"
                    value={formData.defaultStock}
                    onChange={(e) => setFormData({ ...formData, defaultStock: Number(e.target.value) })}
                    className="w-full px-4 py-2 bg-neutral-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                    min="0"
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 rounded border-neutral-300 text-primary-500 focus:ring-primary-500"
                  />
                  <label htmlFor="isActive" className="text-sm text-neutral-600">
                    Menu Aktif
                  </label>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 px-4 py-2 bg-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-300"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {createMutation.isPending || updateMutation.isPending ? 'Menyimpan...' : 'Simpan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
