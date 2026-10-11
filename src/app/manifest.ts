import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "InsureWise",
    short_name: "InsureWise",
    description: "Know what your health policy covers, in plain words.",
    start_url: "/app",
    display: "standalone",
    background_color: "#fbfaf7",
    theme_color: "#18233b",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
