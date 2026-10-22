import type { Metadata } from "next";
import { z } from "zod";
import raw from "../../branding.json";

// Logo e favicon si cambiano da branding.json, nella radice del progetto.
// I percorsi sono relativi a public/ (es. "/brand/logo.svg") oppure URL assoluti.
const path = z.string().min(1);

const schema = z.object({
  name: z.string().min(1),
  logo: path,
  favicon: z.object({
    svg: path.optional(),
    png: path.optional(),
    ico: path.optional(),
    appleTouchIcon: path.optional(),
  }),
});

export type Branding = z.infer<typeof schema>;

// Un errore nel JSON ferma la build, invece di lasciare l'app senza icone.
export const branding: Branding = schema.parse(raw);

const typeOf = (src: string) =>
  src.endsWith(".svg") ? "image/svg+xml" : src.endsWith(".ico") ? "image/x-icon" : "image/png";

export const brandingIcons = ({ favicon }: Branding): NonNullable<Metadata["icons"]> => ({
  icon: [favicon.ico, favicon.svg, favicon.png]
    .filter((src): src is string => src !== undefined)
    .map((url) => ({ url, type: typeOf(url) })),
  apple: favicon.appleTouchIcon,
});
