import Image from "next/image";

import { cn } from "@/lib/utils";

interface BrandMarkProps {
  variant?: "full" | "mark";
  className?: string;
  /** Largura visual (height = width — badge circular). Default 88px (mark) / 120px (full). */
  width?: number;
}

/**
 * Logo oficial de La Vaca Negra.
 * Badge circular único — mesma imagem para "mark" e "full", apenas tamanhos diferentes.
 */
export function BrandMark({
  variant = "full",
  className,
  width,
}: BrandMarkProps) {
  const w = width ?? (variant === "mark" ? 56 : 120);
  return (
    <Image
      src="/brand/logo-2024.png"
      alt="La Vaca Negra"
      width={w}
      height={w}
      priority
      className={cn("shrink-0", className)}
    />
  );
}
