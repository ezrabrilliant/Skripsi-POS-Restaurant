// UsersPage - REV 2.3 owner-only manajemen user.
// Group: Owner + Staf (kasir + waiter). CRUD dgn Dialog form, confirm delete.

import { useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, UserX, User as UserIcon, Shield, Users as UsersIcon } from 'lucide-react'
import { userService } from '@/services'
import { useAuthStore } from '@/stores/authStore'
import { ROLE_LABELS } from '@/types'
import type { User as UserType, UserRole } from '@/types'
import { cn } from '@/lib/utils'
import {
  Button,
  IconButton,
  Badge,
  Skeleton,
  Dialog,
  Input,
  Checkbox,
  Combobox,
  EmptyState,
  Page,
  type ComboboxOption,
} from '@/design-system/primitives'
import { useToast } from '@/design-system/hooks/useToast'
import { useConfirm } from '@/design-system/hooks/useConfirm'

type UserFormData = {
  name: string
  pin: string
  role: UserRole
  isActive: boolean
}

const ROLE_OPTIONS: ComboboxOption[] = [
  { value: 'cashier', label: 'Kasir' },
  { value: 'waiter', label: 'Pelayan' },
  { value: 'owner', label: 'Owner' },
]

const initialFormData: UserFormData = { name: '', pin: '', role: 'cashier', isActive: true }

export default function UsersPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserType | null>(null)
  const [formData, setFormData] = useState<UserFormData>(initialFormData)
  const toast = useToast()
  const confirm = useConfirm()
  const queryClient = useQueryClient()
  const { user: currentUser, setUser } = useAuthStore()

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: userService.getAllUsers,
  })

  const createMutation = useMutation({
    mutationFn: userService.createUser,
    onSuccess: () => {
      toast.success('User berhasil ditambahkan')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      closeModal()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<UserFormData> }) =>
      userService.updateUser(id, data),
    onSuccess: (updated) => {
      toast.success('User berhasil diupdate')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      if (updated.id === currentUser?.id) setUser(updated)
      closeModal()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: userService.deleteUser,
    onSuccess: () => {
      toast.success('User dinonaktifkan')
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const openCreateModal = () => {
    setEditingUser(null)
    setFormData(initialFormData)
    setIsModalOpen(true)
  }

  const openEditModal = (user: UserType) => {
    setEditingUser(user)
    setFormData({ name: user.name, pin: '', role: user.role, isActive: user.isActive })
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingUser(null)
    setFormData(initialFormData)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    // Backend wajib PIN tepat 6 digit (^\d{6}$). Create: wajib. Edit: boleh
    // kosong (tidak diubah), tapi kalau diisi wajib 6 digit.
    if (!editingUser && formData.pin.length !== 6) {
      toast.error('PIN harus 6 digit angka')
      return
    }
    if (editingUser && formData.pin && formData.pin.length !== 6) {
      toast.error('PIN harus 6 digit angka')
      return
    }
    if (editingUser) {
      const updateData: Partial<UserFormData> = {
        name: formData.name,
        role: formData.role,
        isActive: formData.isActive,
      }
      if (formData.pin) updateData.pin = formData.pin
      updateMutation.mutate({ id: editingUser.id, data: updateData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleDelete = async (user: UserType) => {
    if (user.id === currentUser?.id) {
      toast.error('Tidak dapat menonaktifkan akun sendiri')
      return
    }
    const ok = await confirm({
      title: `Nonaktifkan user "${user.name}"?`,
      description: 'Akun dinonaktifkan (tidak bisa login). Bisa diaktifkan lagi nanti lewat Edit.',
      confirmText: 'Ya, Nonaktifkan',
      tone: 'danger',
    })
    if (!ok) return
    deleteMutation.mutate(user.id)
  }

  const owners = users.filter((u: UserType) => u.role === 'owner')
  const staff = users.filter((u: UserType) => u.role === 'cashier' || u.role === 'waiter')
  const isSelfEdit = editingUser?.id === currentUser?.id

  return (
    <Page
      title="Manajemen User"
      subtitle="Kelola akun owner, kasir, dan waiter"
      actions={
        <Button
          variant="primary"
          size="md"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={openCreateModal}
        >
          Tambah User
        </Button>
      }
    >
      <div className="max-w-3xl mx-auto space-y-5">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : (
          <>
            <UserGroup
              icon={<Shield className="w-5 h-5 text-warning-700" />}
              title="Owner"
              count={owners.length}
              users={owners}
              currentUserId={currentUser?.id}
              onEdit={openEditModal}
              onDelete={handleDelete}
            />
            <UserGroup
              icon={<UsersIcon className="w-5 h-5 text-primary-700" />}
              title="Staf - Kasir & Pelayan"
              count={staff.length}
              users={staff}
              currentUserId={currentUser?.id}
              onEdit={openEditModal}
              onDelete={handleDelete}
              emptyMessage="Belum ada staf. Tambah lewat tombol di atas."
            />
          </>
        )}

        {isModalOpen && (
          <Dialog
            open
            onOpenChange={(o) => !o && closeModal()}
            title={editingUser ? 'Edit User' : 'Tambah User Baru'}
            description={
              editingUser?.id === currentUser?.id
                ? 'Anda sedang edit akun sendiri. Role dikunci.'
                : undefined
            }
            size="sm"
            footer={
              <Button
                type="submit"
                form="user-form"
                variant="primary"
                size="md"
                fullWidth
                loading={createMutation.isPending || updateMutation.isPending}
              >
                Simpan
              </Button>
            }
          >
            <form id="user-form" onSubmit={handleSubmit} className="space-y-3">
              <Input
                label="Nama"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                autoFocus
              />
              <Input
                label={`PIN (4-6 digit)${editingUser ? ' - kosongkan jika tidak diubah' : ''}`}
                type="password"
                inputMode="numeric"
                value={formData.pin}
                onChange={(e) =>
                  setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })
                }
                required={!editingUser}
                maxLength={6}
                placeholder="••••••"
              />
              <Combobox
                label="Role"
                value={formData.role}
                onValueChange={(v) => setFormData({ ...formData, role: v as UserRole })}
                options={ROLE_OPTIONS}
                disabled={isSelfEdit}
                helper={isSelfEdit ? 'Tidak dapat mengubah role sendiri' : undefined}
                searchPlaceholder="Cari role..."
              />
              {editingUser && !isSelfEdit && (
                <Checkbox
                  label="Akun aktif (bisa login & dipakai)"
                  checked={formData.isActive}
                  onCheckedChange={(c) => setFormData({ ...formData, isActive: c })}
                />
              )}
            </form>
          </Dialog>
        )}
      </div>
    </Page>
  )
}

function UserGroup({
  icon,
  title,
  count,
  users,
  currentUserId,
  onEdit,
  onDelete,
  emptyMessage,
}: {
  icon: React.ReactNode
  title: string
  count: number
  users: UserType[]
  currentUserId?: number
  onEdit: (user: UserType) => void
  onDelete: (user: UserType) => void
  emptyMessage?: string
}) {
  return (
    <section>
      <h2 className="text-title font-semibold text-neutral-900 mb-3 flex items-center gap-2">
        {icon}
        {title}
        <Badge tone="neutral" size="sm">{count}</Badge>
      </h2>
      <div className="space-y-2">
        {users.length === 0 ? (
          <EmptyState title={emptyMessage ?? 'Belum ada user'} compact />
        ) : (
          users.map((u) => (
            <UserCard
              key={u.id}
              user={u}
              isCurrent={u.id === currentUserId}
              onEdit={() => onEdit(u)}
              onDelete={() => onDelete(u)}
            />
          ))
        )}
      </div>
    </section>
  )
}

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
    <div
      className={cn(
        'bg-white rounded-xl p-3 sm:p-4 flex items-center justify-between gap-3 border border-neutral-200/60',
        !user.isActive && 'opacity-60',
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
            user.role === 'owner' ? 'bg-warning-100' : 'bg-primary-100'
          )}
        >
          <UserIcon
            className={cn(
              'w-5 h-5',
              user.role === 'owner' ? 'text-warning-700' : 'text-primary-700'
            )}
          />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-body font-semibold text-neutral-900 truncate">{user.name}</p>
            {isCurrent && (
              <Badge tone="primary" size="sm">
                Anda
              </Badge>
            )}
            {!user.isActive && (
              <Badge tone="neutral" size="sm">
                Nonaktif
              </Badge>
            )}
          </div>
          <p className="text-body-sm text-neutral-600">{ROLE_LABELS[user.role]}</p>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <IconButton label="Edit user" icon={<Pencil />} variant="ghost" size="sm" onClick={onEdit} />
        <IconButton
          label="Nonaktifkan user"
          icon={<UserX />}
          variant="ghost"
          size="sm"
          onClick={onDelete}
          disabled={isCurrent || !user.isActive}
          className="text-danger-700 hover:bg-danger-50"
        />
      </div>
    </div>
  )
}
