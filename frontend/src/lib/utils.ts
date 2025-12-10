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
