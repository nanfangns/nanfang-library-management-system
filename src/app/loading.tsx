export default function Loading() {
  return (
    <main className="page-shell">
      <section className="panel loading-hero">
        <div className="skeleton skeleton--eyebrow" />
        <div className="skeleton skeleton--title" />
        <div className="skeleton skeleton--copy" />
        <div className="skeleton skeleton--copy short" />
      </section>

      <section className="loading-grid">
        <div className="panel">
          <div className="skeleton skeleton--copy" />
          <div className="skeleton skeleton--copy short" />
          <div className="skeleton skeleton--field" />
        </div>

        <div className="panel">
          <div className="skeleton skeleton--copy" />
          <div className="skeleton skeleton--field" />
          <div className="skeleton skeleton--field" />
          <div className="skeleton skeleton--field tall" />
        </div>
      </section>
    </main>
  );
}
