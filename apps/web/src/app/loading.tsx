export default function Loading() {
  return (
    <div className="grid" style={{ gap: 20 }} aria-busy="true" aria-label="Loading">
      <div className="skeleton" style={{ height: 36, width: 260 }} />
      <div className="grid cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 110 }} />)}
      </div>
      <div className="skeleton" style={{ height: 240 }} />
    </div>
  );
}
