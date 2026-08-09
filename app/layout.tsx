import type { Metadata } from "next";
import { Archivo_Narrow, Fragment_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const archivoNarrow = Archivo_Narrow({
  variable: "--font-cotation",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-papier",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const fragmentMono = Fragment_Mono({
  variable: "--font-mesure",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: 'Générateur de rendu',
  description: 'Production de rendus architecturaux à partir d\'exports Revit.',
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${archivoNarrow.variable} ${sourceSerif.variable} ${fragmentMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
