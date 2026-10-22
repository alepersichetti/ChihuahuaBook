import { branding } from "@/config/branding";

// Logo dell'app, preso da branding.json.
export function Logo({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- il percorso arriva dalla configurazione, può essere SVG o URL esterno
    <img src={branding.logo} alt={branding.name} width={size} height={size} className={`shrink-0 ${className}`} />
  );
}
