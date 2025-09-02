import { ReactNode } from 'react';

export default function FeatureCard({
  title,
  desc,
  icon,
}: {
  title: string;
  desc: string;
  icon: ReactNode;
}) {
  return (
    <div
      className="p-5 rounded-xl h-full"
      style={{
        backgroundColor: '#111315',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div className="mb-3">{icon}</div>
      <h3 className="text-lg font-medium mb-1.5 text-white/90">{title}</h3>
      <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
    </div>
  );
}