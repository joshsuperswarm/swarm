export default function CtaButton({
  children,
  href,
  onClick,
  size = 'md',
}: {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
}) {
  const padding =
    size === 'sm'
      ? 'px-4 py-2 text-sm'
      : size === 'lg'
      ? 'px-6 py-3 text-base'
      : 'px-5 py-2.5 text-sm';

  return href ? (
    <a
      href={href}
      className={`${padding} inline-flex items-center justify-center rounded-md font-medium transition-transform duration-150 text-[#0f172a]`}
      style={{
        backgroundColor: '#7dd3fc',
        boxShadow: '0 6px 28px rgba(125,211,252,0.35)',
      }}
    >
      {children}
    </a>
  ) : (
    <button
      onClick={onClick}
      className={`${padding} inline-flex items-center justify-center rounded-md font-medium transition-transform duration-150 cursor-pointer text-[#0f172a]`}
      style={{
        backgroundColor: '#7dd3fc',
        boxShadow: '0 6px 28px rgba(125,211,252,0.35)',
      }}
    >
      {children}
    </button>
  );
}