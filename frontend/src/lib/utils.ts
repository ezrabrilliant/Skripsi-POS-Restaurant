import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function formatTime(date: string | Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15)
}

export function getTodayDate(): string {
  return new Date().toISOString().split('T')[0]
}

export function getStockStatus(remaining: number): 'available' | 'low' | 'empty' {
  if (remaining <= 0) return 'empty'
  if (remaining <= 5) return 'low'
  return 'available'
}

export function getStockStatusClasses(remaining: number): string {
  const status = getStockStatus(remaining)
  switch (status) {
    case 'available':
      return 'border-primary-500'
    case 'low':
      return 'border-warning-500 bg-warning-50'
    case 'empty':
      return 'border-warning-600 bg-warning-50'
    default:
      return 'border-neutral-200'
  }
}

// Color palette for categories - readable colors with good contrast
const CATEGORY_COLOR_PALETTE = [
  { // Orange
    bg: 'bg-orange-100',
    bgHover: 'hover:bg-orange-200',
    bgSelected: 'bg-orange-600',
    border: 'border-orange-400',
    text: 'text-neutral-800',
    textPrice: 'text-neutral-900',
    chipBg: 'bg-orange-100',
    chipBorder: 'border-orange-500',
    chipText: 'text-orange-900',
  },
  { // Teal
    bg: 'bg-teal-100',
    bgHover: 'hover:bg-teal-200',
    bgSelected: 'bg-teal-600',
    border: 'border-teal-400',
    text: 'text-neutral-800',
    textPrice: 'text-neutral-900',
    chipBg: 'bg-teal-100',
    chipBorder: 'border-teal-500',
    chipText: 'text-teal-900',
  },
  { // Blue
    bg: 'bg-blue-100',
    bgHover: 'hover:bg-blue-200',
    bgSelected: 'bg-blue-600',
    border: 'border-blue-400',
    text: 'text-neutral-800',
    textPrice: 'text-neutral-900',
    chipBg: 'bg-blue-100',
    chipBorder: 'border-blue-500',
    chipText: 'text-blue-900',
  },
  { // Green
    bg: 'bg-green-100',
    bgHover: 'hover:bg-green-200',
    bgSelected: 'bg-green-600',
    border: 'border-green-400',
    text: 'text-neutral-800',
    textPrice: 'text-neutral-900',
    chipBg: 'bg-green-100',
    chipBorder: 'border-green-500',
    chipText: 'text-green-900',
  },
  { // Violet
    bg: 'bg-violet-100',
    bgHover: 'hover:bg-violet-200',
    bgSelected: 'bg-violet-600',
    border: 'border-violet-400',
    text: 'text-neutral-800',
    textPrice: 'text-neutral-900',
    chipBg: 'bg-violet-100',
    chipBorder: 'border-violet-500',
    chipText: 'text-violet-900',
  },
  { // Rose
    bg: 'bg-rose-100',
    bgHover: 'hover:bg-rose-200',
    bgSelected: 'bg-rose-600',
    border: 'border-rose-400',
    text: 'text-neutral-800',
    textPrice: 'text-neutral-900',
    chipBg: 'bg-rose-100',
    chipBorder: 'border-rose-500',
    chipText: 'text-rose-900',
  },
  { // Cyan
    bg: 'bg-cyan-100',
    bgHover: 'hover:bg-cyan-200',
    bgSelected: 'bg-cyan-600',
    border: 'border-cyan-400',
    text: 'text-neutral-800',
    textPrice: 'text-neutral-900',
    chipBg: 'bg-cyan-100',
    chipBorder: 'border-cyan-500',
    chipText: 'text-cyan-900',
  },
  { // Amber
    bg: 'bg-amber-100',
    bgHover: 'hover:bg-amber-200',
    bgSelected: 'bg-amber-600',
    border: 'border-amber-400',
    text: 'text-neutral-800',
    textPrice: 'text-neutral-900',
    chipBg: 'bg-amber-100',
    chipBorder: 'border-amber-500',
    chipText: 'text-amber-900',
  },
  { // Emerald
    bg: 'bg-emerald-100',
    bgHover: 'hover:bg-emerald-200',
    bgSelected: 'bg-emerald-600',
    border: 'border-emerald-400',
    text: 'text-neutral-800',
    textPrice: 'text-neutral-900',
    chipBg: 'bg-emerald-100',
    chipBorder: 'border-emerald-500',
    chipText: 'text-emerald-900',
  },
  { // Indigo
    bg: 'bg-indigo-100',
    bgHover: 'hover:bg-indigo-200',
    bgSelected: 'bg-indigo-600',
    border: 'border-indigo-400',
    text: 'text-neutral-800',
    textPrice: 'text-neutral-900',
    chipBg: 'bg-indigo-100',
    chipBorder: 'border-indigo-500',
    chipText: 'text-indigo-900',
  },
]

export type CategoryColorScheme = typeof CATEGORY_COLOR_PALETTE[0]

// Generate a consistent hash from category name
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

// Cache untuk menyimpan mapping kategori ke warna
const categoryColorCache = new Map<string, CategoryColorScheme>()

// Get color for a category - consistent color for same category name
export function getCategoryColor(category: string, allCategories?: string[]): CategoryColorScheme {
  // Check cache first
  if (categoryColorCache.has(category)) {
    return categoryColorCache.get(category)!
  }
  
  // If all categories provided, assign colors in order
  if (allCategories && allCategories.length > 0) {
    const index = allCategories.indexOf(category)
    if (index !== -1) {
      const color = CATEGORY_COLOR_PALETTE[index % CATEGORY_COLOR_PALETTE.length]
      categoryColorCache.set(category, color)
      return color
    }
  }
  
  // Fallback: use hash of category name
  const hash = hashString(category)
  const color = CATEGORY_COLOR_PALETTE[hash % CATEGORY_COLOR_PALETTE.length]
  categoryColorCache.set(category, color)
  return color
}

// Initialize colors for all categories (call this once when categories are loaded)
export function initCategoryColors(categories: string[]): void {
  categoryColorCache.clear()
  categories.forEach((category, index) => {
    categoryColorCache.set(category, CATEGORY_COLOR_PALETTE[index % CATEGORY_COLOR_PALETTE.length])
  })
}
