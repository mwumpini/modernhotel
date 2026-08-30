export default function KitchenDisplayLoading() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-3 p-8">
      <div className="text-5xl">🍳</div>
      <p className="text-xl font-bold tracking-wide">Kitchen Display</p>
      <p className="text-sm text-gray-400 animate-pulse">Loading order queue…</p>
    </div>
  );
}
