"use client";

type Props = {
  children: React.ReactNode;
  className?: string;
};

export function PrintButton({ children, className }: Props) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={className}
    >
      {children}
    </button>
  );
}
