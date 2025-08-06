import Image from 'next/image';
import WaitlistForm from 'app/components/waitlist-form';
import { PricingTable } from '@clerk/nextjs';

export default function Page() {
  return (
    <div
      className="text-[#EAEAEA] font-sans min-h-screen"
      style={{
        background:
          'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
      }}
    >
      {/* Video Section - Full Width at Top */}
      <div className="w-full px-8 pt-8">
        <div className="max-w-4xl mx-auto">
          <div className="w-full rounded-lg overflow-hidden">
            <div style={{ padding: '56.25% 0 0 0', position: 'relative' }}>
              <iframe
                src="https://player.vimeo.com/video/1106242932?badge=0&autopause=0&player_id=0&app_id=58479"
                frameBorder="0"
                allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                }}
                title="Swarm Teaser 1080p"
              />
            </div>
            <script src="https://player.vimeo.com/api/player.js"></script>
          </div>
        </div>
      </div>

      {/* Logo and Content Section */}
      <div className="flex justify-center px-8 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Desktop Layout: Logo on Left, Content on Right */}
          <div className="hidden md:flex gap-16">
            {/* Logo on Left */}
            <div className="flex-shrink-0">
              <Image
                src="/swarm-logo-new.png"
                alt="Swarm"
                width={400}
                height={400}
                priority
                className=""
              />
            </div>

            {/* Content on Right */}
            <div className="flex-1 max-w-2xl flex flex-col justify-start">
              {/* Main headline */}
              <h2 className="text-4xl md:text-5xl font-light mb-6 leading-tight tracking-tight -mt-4">
                Vibing at the speed of thought.
              </h2>

              {/* Description */}
              <p className="text-lg text-gray-400 mb-8 leading-relaxed font-light">
                Swarm is an Agent IDE designed for speed, allowing you to
                acheive flow while managing multiple coding agents.{' '}
                <a
                  href="https://twitter.com/jmvldz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-500 hover:text-gray-300 transition-colors"
                >
                  <svg
                    className="w-4 h-4 inline -translate-y-0.5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
              </p>

              {/* Waitlist Form */}
              <WaitlistForm />
            </div>
          </div>

          {/* Mobile Layout: Single Column */}
          <div className="md:hidden flex flex-col">
            {/* Logo */}
            <div className="mb-8">
              <Image
                src="/swarm-logo-new.png"
                alt="Swarm"
                width={300}
                height={300}
                priority
                className=""
              />
            </div>

            {/* Content */}
            <div className="max-w-lg">
              {/* Main headline */}
              <h2 className="text-3xl font-light mb-6 leading-tight tracking-tight">
                Vibing at the speed of thought.
              </h2>

              {/* Description */}
              <p className="text-base text-gray-400 mb-8 leading-relaxed font-light">
                Swarm is an Agent IDE designed for speed, allowing you to
                acheive flow while managing multiple coding agents.{' '}
                <a
                  href="https://twitter.com/jmvldz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-500 hover:text-gray-300 transition-colors"
                >
                  <svg
                    className="w-4 h-4 inline -translate-y-0.5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
              </p>

              {/* Waitlist Form */}
              <WaitlistForm />
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div className="px-8 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-light mb-4 text-white">
              Choose Your Plan
            </h2>
            <p className="text-lg text-gray-400 font-light">
              Get started with Swarm today
            </p>
          </div>
          <div className="flex justify-center">
            <div className="w-full max-w-4xl">
              <PricingTable />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
