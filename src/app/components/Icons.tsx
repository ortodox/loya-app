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
