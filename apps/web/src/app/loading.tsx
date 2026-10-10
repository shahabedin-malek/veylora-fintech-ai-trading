import LatticeLoader from "@/components/reactbits/LatticeLoader";

/**
 * Route-level loading state.
 *
 * The skeleton is kept for layout stability while the animated lattice communicates
 * that work is in progress (it is `role="status"`, so screen readers get the same
 * signal from the live region rather than from the animation).
 */
export default function Loading() {
  return (
    <div className="grid" style={{ gap: 20 }} aria-busy="true" aria-label="Loading">
      <div className="loading-row">
        <LatticeLoader label="Loading" status="working" grid={3} pattern="orbit" cellSize={6} showTimer={false} />
      </div>
      <div className="skeleton" style={{ height: 36, width: 260 }} />
      <div className="grid cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 110 }} />)}
      </div>
      <div className="skeleton" style={{ height: 240 }} />
    </div>
  );
}
