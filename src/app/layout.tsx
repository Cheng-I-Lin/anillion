import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "anillion — Go beyond the main character.",
  description:
    "An anime rarity game for the deeply obsessed. Name the unexpected, find rare answers, and turn your anime knowledge into a high score.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
