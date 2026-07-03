import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FABLEMOTION — prompt-to-motion studio",
  description:
    "Describe a launch video. Watch it assemble live. Render the MP4. Drive it from the web agent or straight from your Claude Code terminal over MCP.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="grain">{children}</body>
    </html>
  );
}
