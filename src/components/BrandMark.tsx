import { cx } from '../lib/utils'

export function BrandMark({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <span className={cx('brand-mark', `brand-mark-${size}`, className)} aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none">
        <path d="M9.2 16.4 13.8 21 23 10.9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

export function BrandWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand-wordmark">
      <BrandMark />
      {!compact && <span>Cadence</span>}
    </span>
  )
}
