export const metadata = { title: "Pulse SA", description: "What South Africa is struggling with, right now." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#0B0F14", color: "#EAF2F7", fontFamily: "system-ui, sans-serif" }}>{children}</body>
    </html>
  );
}
