"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X, ArrowUpRight, Sparkles } from "lucide-react";
import type { Rarity, RarityCoverage } from "@/lib/types";
export function Brand({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand ${small ? "small" : ""}`}>
      <span className="brand-mark">
        a<span />
      </span>
      {!small && (
        <span>
          anillion<span className="brand-dot">.</span>
        </span>
      )}
    </span>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const els = ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input,select,a[href],[tabindex="0"]',
        );
        if (!els?.length) return;
        const first = els[0],
          last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = old;
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        tabIndex={-1}
        ref={ref}
        className={`modal ${wide ? "wide" : ""}`}
      >
        <div className="modal-head">
          <div>
            <span className="eyebrow red">ANILLION FIELD GUIDE</span>
            <h2 id="dialog-title">{title}</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function RarityBadge({ rarity }: { rarity: Rarity | null }) {
  return rarity ? (
    <span className={`rarity-badge rarity-${rarity.toLowerCase()}`}>
      <Sparkles size={12} />
      {rarity}
    </span>
  ) : (
    <span className="rarity-badge">No answer</span>
  );
}
export function SectionTitle({
  eyebrow,
  title,
  action,
  onAction,
}: {
  eyebrow?: string;
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {action && (
        <button className="text-button" onClick={onAction}>
          {action}
          <ArrowUpRight size={15} />
        </button>
      )}
    </div>
  );
}

export function RarityRange({ coverage }: { coverage?: RarityCoverage }) {
  const tiers = ["Common", "Uncommon", "Rare", "Epic", "Legendary"] as const;
  return (
    <div className="rarity-range" aria-label="All five rarity tiers available">
      {tiers.map((tier) => (
        <span
          key={tier}
          className={`range-dot ${tier.toLowerCase()}`}
          title={`${tier}${coverage ? `: ${coverage[tier]} curated answers` : ""}`}
        >
          <span className="sr-only">
            {tier}
            {coverage ? `: ${coverage[tier]} curated answers` : ""}
          </span>
        </span>
      ))}
      <span>Common → Legendary</span>
    </div>
  );
}
