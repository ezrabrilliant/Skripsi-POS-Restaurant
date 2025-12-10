import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, X, Save, User, Shield, Users } from 'lucide-react'
import { userService } from '@/services'
import { useAuthStore } from '@/stores/authStore'
import { User as UserType, UserRole } from '@/types'

type UserFormData = {
  name: string
  pin: string
  role: UserRole
}

const initialFormData: UserFormData = {
  name: '',
  pin: '',
  role: 'cashier',
}

export default function UsersPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserType | null>(null)
  const [formData, setFormData] = useState<UserFormData>(initialFormData)
  
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuthStore()
  
  // Fetch users
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: userService.getAllUsers,
  })
  
  // Create mutation
  const createMutation = useMutation({
    mutationFn: userService.createUser,
    onSuccess: () => {
      toast.success('User berhasil ditambahkan')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      closeModal()
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
  
  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: Partial<UserFormData> }) =>
      userService.updateUser(id, data),
    onSuccess: () => {
      toast.success('User berhasil diupdate')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      closeModal()
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
  
  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: userService.deleteUser,
    onSuccess: () => {
      toast.success('User berhasil dihapus')
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
  
  const openCreateModal = () => {
    setEditingUser(null)
    setFormData(initialFormData)
    setIsModalOpen(true)
  }
  
  const openEditModal = (user: UserType) => {
    setEditingUser(user)
    setFormData({
      name: user.name,
      pin: '', // Don't show current PIN
      role: user.role,
    })
    setIsModalOpen(true)
  }
  
  const closeModal = () => {
    setIsModalOpen(false)
    setEditingUser(null)
    setFormData(initialFormData)
  }
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate PIN
    if (!editingUser && (formData.pin.length < 4 || formData.pin.length > 6)) {
      toast.error('PIN harus 4-6 digit')
      return
    }
    
    if (editingUser) {
      // Only include PIN if it's provided
      const updateData: Partial<UserFormData> = {
        name: formData.name,
        role: formData.role,
      }
      if (formData.pin) {
        updateData.pin = formData.pin
      }
      updateMutation.mutate({ id: editingUser.id, data: updateData })
    } else {
      createMutation.mutate(formData)
    }
  }
  
  const handleDelete = (id: string, name: string) => {
    if (id === currentUser?.id) {
      toast.error('Tidak dapat menghapus akun sendiri')
      return
    }
    if (confirm(`Hapus user "${name}"?`)) {
      deleteMutation.mutate(id)
    }
  }
  
  // Separate owners and cashiers
  const owners = users.filter((u: UserType) => u.role === 'owner')
  const cashiers = users.filter((u: UserType) => u.role === 'cashier')
  
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-neutral-800">Manajemen User</h1>
            <p className="text-neutral-500">Kelola akun kasir dan owner</p>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
          >
            <Plus className="w-5 h-5" />
            Tambah User
          </button>
        </div>
        
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-neutral-200 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Owners */}
            <div>
              <h2 className="font-semibold text-neutral-700 mb-3 flex items-center gap-2">
                <Shield className="w-5 h-5 text-warning-500" />
                Owner ({owners.length})
              </h2>
              <div className="space-y-2">
                {owners.map((user: UserType) => (
                  <UserCard
                    key={user.id}
                    user={user}
                    isCurrent={user.id === currentUser?.id}
                    onEdit={() => openEditModal(user)}
                    onDelete={() => handleDelete(user.id, user.name)}
                  />
                ))}
              </div>
            </div>
            
            {/* Cashiers */}
            <div>
              <h2 className="font-semibold text-neutral-700 mb-3 flex items-center gap-2">
                <Users className="w-5 h-5 text-primary-500" />
                Kasir ({cashiers.length})
              </h2>
              <div className="space-y-2">
                {cashiers.length === 0 ? (
                  <p className="text-neutral-500 text-center py-8">Belum ada kasir</p>
                ) : (
                  cashiers.map((user: UserType) => (
                    <UserCard
                      key={user.id}
                      user={user}
                      isCurrent={user.id === currentUser?.id}
                      onEdit={() => openEditModal(user)}
                      onDelete={() => handleDelete(user.id, user.name)}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold">
                  {editingUser ? 'Edit User' : 'Tambah User Baru'}
                </h2>
                <button onClick={closeModal} className="p-2 hover:bg-neutral-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm text-neutral-600 mb-1">Nama</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 bg-neutral-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-neutral-600 mb-1">
                    PIN (4-6 digit)
                    {editingUser && <span className="text-neutral-400 ml-1">- kosongkan jika tidak ingin mengubah</span>}
                  </label>
                  <input
                    type="password"
                    value={formData.pin}
                    onChange={(e) => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                    className="w-full px-4 py-2 bg-neutral-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required={!editingUser}
                    maxLength={6}
                    placeholder="••••••"
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-neutral-600 mb-1">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                    className="w-full px-4 py-2 bg-neutral-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={editingUser?.id === currentUser?.id}
                  >
                    <option value="cashier">Kasir</option>
                    <option value="owner">Owner</option>
                  </select>
                  {editingUser?.id === currentUser?.id && (
                    <p className="text-xs text-neutral-400 mt-1">Tidak dapat mengubah role sendiri</p>
                  )}
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

// User Card Component
function UserCard({
  user,
  isCurrent,
  onEdit,
  onDelete,
}: {
  user: UserType
  isCurrent: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="bg-white rounded-lg p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
          user.role === 'owner' ? 'bg-warning-100' : 'bg-primary-100'
        }`}>
          <User className={`w-5 h-5 ${
            user.role === 'owner' ? 'text-warning-600' : 'text-primary-600'
          }`} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-neutral-800">{user.name}</p>
            {isCurrent && (
              <span className="px-2 py-0.5 bg-primary-100 text-primary-600 text-xs rounded">
                Anda
              </span>
            )}
          </div>
          <p className="text-sm text-neutral-500 capitalize">{user.role}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onEdit}
          className="p-2 bg-neutral-100 rounded-lg hover:bg-neutral-200"
        >
          <Pencil className="w-4 h-4 text-neutral-600" />
        </button>
        <button
          onClick={onDelete}
          disabled={isCurrent}
          className="p-2 bg-danger-50 rounded-lg hover:bg-danger-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Trash2 className="w-4 h-4 text-danger-500" />
        </button>
      </div>
    </div>
  )
}
