export const metadata = {
  title: 'EVE ESI LLM Bridge',
  description: 'Self-hosted EVE Online ESI bridge for MCP-capable AI clients.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 880, margin: '40px auto', padding: '0 20px', lineHeight: 1.55 }}>
        {children}
      </body>
    </html>
  );
}
