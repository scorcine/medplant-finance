import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "MedPlant — Finanças e investimentos",
    short_name: "MedPlant",
    description: "Organização financeira pessoal e familiar, com agenda de plantões e carteira de investimentos",
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0c0f14",
    theme_color: "#0c0f14",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Gastos", url: "/gastos", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Agenda", url: "/agenda", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Balanço", url: "/balanco", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
