export default function HeroBadge() {
  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium"
      style={{
        backgroundColor: '#334155',
        color: '#ffffff',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: '#7dd3fc' }}
      />
      Agent IDE
    </div>
  );
}