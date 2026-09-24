export default function BlockedSession() {
  return (
    <main className="blocked-session-page">
      <section className="blocked-session-card" role="alert">
        <div className="brand-mark">D</div>
        <h1>DevFlow is already open in another tab.</h1>
        <p>Please continue using the existing DevFlow tab.</p>
        <p className="muted">
          Close the other tab, then refresh this page to use DevFlow here.
        </p>
      </section>
    </main>
  );
}
