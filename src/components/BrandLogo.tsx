import logoLight from "../assets/logo-light.png";
import logoDark from "../assets/logo-dark.png";

interface BrandLogoProps {
  theme: "dark" | "light";
  size?: number;
  className?: string;
}

/**
 * Renders the crisp DestTraky D-arrow brand mark:
 *  - Dark mode  -> Light/White logo variant
 *  - Light mode -> Dark/Black logo variant
 */
export function BrandLogo({ theme, size = 28, className = "" }: BrandLogoProps) {
  return (
    <img
      src={theme === "dark" ? logoLight : logoDark}
      alt="DestTraky"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`object-contain select-none shrink-0 transition-opacity duration-200 ${className}`}
      draggable={false}
    />
  );
}
