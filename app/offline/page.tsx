export default function OfflinePage() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Anex Sales — Offline</title>
        <style>{`
          body { margin: 0; font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
            background: #EEF2F7; display: flex; align-items: center;
            justify-content: center; min-height: 100vh; }
          .card { background: white; border-radius: 12px; padding: 48px 32px;
            text-align: center; max-width: 400px; box-shadow: 0 4px 12px rgba(0,0,0,.1); }
          .icon { font-size: 48px; margin-bottom: 16px; }
          h1 { color: #1B2A4A; font-size: 22px; font-weight: 800; margin: 0 0 8px; }
          p { color: #4A5568; font-size: 14px; margin: 0 0 24px; line-height: 1.6; }
          a { display: inline-block; background: #1B2A4A; color: white;
            text-decoration: none; padding: 12px 24px; border-radius: 8px;
            font-size: 14px; font-weight: 600; }
        `}</style>
      </head>
      <body>
        <div className="card">
          <div className="icon">📡</div>
          <h1>You're offline</h1>
          <p>No internet connection detected. Some pages are available offline — check your connection and try again.</p>
          <a href="/sales/dashboard">Go to Dashboard</a>
        </div>
      </body>
    </html>
  );
}
