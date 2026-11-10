export function Chevron({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={`size-5 ${className ?? ""}`} fill="none">
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WarningIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={`size-5 ${className ?? ""}`} fill="none">
      <path
        d="M12 3.5 21.5 20h-19L12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M12 10v4.5M12 17.2v.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Tab icon «Клиенты»: two people. */
export function ClientsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={`size-6 ${className ?? ""}`} fill="none">
      <circle cx="9" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 19.5c.6-3.3 3-5.25 6-5.25s5.4 1.95 6 5.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M15.5 5.2a3 3 0 0 1 0 5.6M17.6 14.6c1.7.7 2.9 2.3 3.4 4.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Tab icon «Препараты»: a vial. */
export function PreparationsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={`size-6 ${className ?? ""}`} fill="none">
      <path d="M9 3h6M10 3v3.2L6.6 11.4A6 6 0 0 0 11.6 21h.8a6 6 0 0 0 5-9.6L14 6.2V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.4 13.5h9.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Z5: the visit has a face scheme. */
export function FaceIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={`size-4 ${className ?? ""}`} fill="none">
      <path d="M12 3c-4 0-6 3.5-6 8s2.5 9 6 10c3.5-1 6-5.5 6-10s-2-8-6-8Z" stroke="currentColor" strokeWidth="1.4" />
      <path d="M9.5 10.5h.01M14.5 10.5h.01M10 15.5c1.2.8 2.8.8 4 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Tab icon «Сегодня»: a calendar page. */
export function TodayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={`size-6 ${className ?? ""}`} fill="none">
      <rect x="3.75" y="5" width="16.5" height="15.25" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3.75 9.75h16.5M8 3v3.5M16 3v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8.5 14.5h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Tab icon ⚙ (settings, icon only). */
export function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={`size-6 ${className ?? ""}`} fill="none">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 2.75v2.1M12 19.15v2.1M21.25 12h-2.1M4.85 12h-2.1M18.54 5.46l-1.49 1.49M6.95 17.05l-1.49 1.49M18.54 18.54l-1.49-1.49M6.95 6.95 5.46 5.46"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="6.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/** Tab icon «Магазин»: a shopping basket. */
export function ShopIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={`size-6 ${className ?? ""}`} fill="none">
      <path d="M3.5 9.5h17l-1.6 9.1a2 2 0 0 1-2 1.65H7.1a2 2 0 0 1-2-1.65L3.5 9.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8.5 9.5 11 4M15.5 9.5 13 4M9.5 13.5v3M14.5 13.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
