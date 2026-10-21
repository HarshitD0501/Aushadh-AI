import "./globals.css";
import "leaflet/dist/leaflet.css";
import { DM_Sans, Playfair_Display } from "next/font/google";
import AuraBackground from "@/components/reactbits/AuraBackground";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata = {
  title: "Aayogya — your medicines, made clear",
  description:
    "Understand your prescriptions, daily schedule, interactions, and nearby pharmacies. Not a substitute for your doctor.",
};

export const viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${playfair.variable} scroll-smooth`}>
      <body className="font-sans antialiased selection:bg-[#f4c4a8] selection:text-[#1a2234]">
        {/* Paper Texture Overlay from Deciding Health template */}
        <div className="fixed inset-0 pointer-events-none z-50 bg-paper-texture mix-blend-multiply" />
        <AuraBackground />
        {children}
      </body>
    </html>
  );
}
