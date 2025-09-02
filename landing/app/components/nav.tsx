import Link from 'next/link';
import Image from 'next/image';

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md border-b border-white/10 bg-[#0f172a]/60">
      <nav className="mx-auto max-w-6xl px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/swarm-logo-new.png"
              alt="Swarm"
              width={28}
              height={28}
              priority
            />
            <span className="text-sm tracking-wide text-gray-300">
              Swarm
            </span>
          </Link>
          
          <div className="flex items-center gap-4">
            <a
              href="https://twitter.com/jmvldz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
            >
              Twitter
            </a>
            <a
              href="#waitlist"
              className="text-xs text-[#0f172a] bg-[#7dd3fc] hover:bg-[#60a5fa] transition-colors px-3 py-1.5 rounded-md"
            >
              Join Beta
            </a>
          </div>
        </div>
      </nav>
    </header>
  );
}
