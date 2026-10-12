/**
 * Minimal route-transition loading state matched to the page background.
 */
export default function Loading() {
  return (
    <div
      className="min-h-screen bg-background"
      aria-busy="true"
      aria-label="Loading"
    />
  );
}
