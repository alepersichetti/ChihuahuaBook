import type { MetadataRoute } from "next";
import { branding } from "@/config/branding";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: branding.name,
    short_name: branding.name,
    start_url: "/",
    display: "standalone",
    icons: (branding.favicon.android ?? []).map((icon) => ({ ...icon, type: "image/png" })),
  };
}
