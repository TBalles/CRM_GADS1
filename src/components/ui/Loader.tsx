import { GoalMark } from "../Logo";

interface LoaderProps {
  text?: string;
  subtext?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: { halo: "h-24 w-24", icon: "h-5 w-5", text: "text-sm" },
  md: { halo: "h-32 w-32", icon: "h-7 w-7", text: "text-base" },
  lg: { halo: "h-40 w-40", icon: "h-9 w-9", text: "text-lg" },
} as const;

/**
 * Loader de marca (DESIGN.md §3.12): halo, anillo con el arco girando, burbuja
 * y el isotipo en blanco sobre el verde de marca. Es el estado de carga
 * canonico de una pagina o lista; para botones se usa un Loader2 en linea
 * (§3.2).
 *
 * Las capas se dimensionan con `inset-[%]` relativo al halo, asi las tres
 * medidas guardan la misma proporcion sin repetir numeros por tamaño.
 */
export const Loader: React.FC<LoaderProps> = ({ text, subtext, size = "md", className = "" }) => {
  const s = SIZES[size];
  return (
    <div
      className={`flex flex-col items-center justify-center text-center animate-in fade-in duration-500 ${className}`}
    >
      <div className={`relative ${s.halo}`} aria-hidden="true">
        {/* Halo */}
        <span className="absolute inset-0 rounded-full bg-brand/10" />
        {/* Anillo: la pista fija y el arco que gira encima */}
        <span className="absolute inset-[13%] rounded-full border-2 border-brand/15" />
        <span className="absolute inset-[13%] rounded-full border-2 border-transparent border-t-brand animate-spin [animation-duration:900ms]" />
        {/* Burbuja con el isotipo */}
        <span className="absolute inset-[24%] flex items-center justify-center rounded-full bg-background shadow-sm">
          <span className="flex h-[74%] w-[74%] items-center justify-center rounded-full bg-logo text-logo-foreground shadow-md">
            <GoalMark className={s.icon} />
          </span>
        </span>
      </div>
      {text && <p className={`mt-5 font-medium text-muted-foreground ${s.text}`}>{text}</p>}
      {subtext && <p className="mt-1 text-xs text-muted-foreground/70">{subtext}</p>}
    </div>
  );
};

export default Loader;
