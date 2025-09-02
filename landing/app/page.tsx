import Image from 'next/image';
import WaitlistForm from 'app/components/waitlist-form';

export default function Page() {
  return (
    <div
      className="text-[#EAEAEA] font-sans min-h-screen"
      style={{
        background:
          'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
      }}
    >
      {/* Main Container */}
      <div className="max-w-5xl mx-auto px-6 py-20">
        {/* Beta Badge */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-900/30 border border-green-700/30">
            <span className="text-xs text-green-400 font-medium">
              Free during beta
            </span>
          </div>
        </div>

        {/* Logo */}
        <div className="flex justify-center mb-12">
          <Image
            src="/swarm-logo-new.png"
            alt="Swarm"
            width={180}
            height={180}
            priority
            className="opacity-90"
          />
        </div>

        {/* Main Headline */}
        <h1 className="text-5xl md:text-6xl font-light text-center mb-8 tracking-tight">
          The easiest way to run AI agents in the cloud
        </h1>

        {/* Subheadline */}
        <div className="text-center mb-12 max-w-3xl mx-auto">
          <p className="text-lg md:text-xl text-gray-300 mb-2">
            Built for developers who want to ship{' '}
            <span className="italic font-medium">fast</span>. Agentic
            development,
          </p>
          <p className="text-lg md:text-xl text-gray-300">
            wherever you are. Fire. Forget. Come back to pull requests.
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <div id="waitlist">
            <WaitlistForm />
          </div>
          <a
            href="https://twitter.com/jmvldz"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-transparent border border-gray-600 text-gray-300 hover:border-gray-400 hover:text-white transition-all"
          >
            <svg
              className="w-4 h-4"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Follow updates
          </a>
        </div>

        {/* Supported Agents */}
        <div className="text-center mb-20">
          <p className="text-sm text-gray-400">
            <span className="font-medium">Supported Agents:</span>{' '}
            <span className="inline-flex items-center gap-1">
              🤖 Claude Code
            </span>{' '}
            <span className="inline-flex items-center gap-1 ml-2">
              🦙 OpenAI Codex
            </span>{' '}
            <span className="text-gray-500 ml-2">
              • more agents coming soon.
            </span>
          </p>
        </div>

        {/* Video Preview with Browser Frame */}
        <div className="relative mx-auto max-w-4xl">
          <div
            className="rounded-xl overflow-hidden shadow-2xl"
            style={{
              background:
                'linear-gradient(135deg, #38bdf8 0%, #22d3ee 50%, #10b981 100%)',
              padding: '3px',
            }}
          >
            <div className="bg-gray-900 rounded-lg overflow-hidden">
              {/* Browser Chrome */}
              <div className="bg-gray-800 px-4 py-3 flex items-center gap-2 border-b border-gray-700">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="bg-gray-700 rounded px-3 py-1 text-xs text-gray-400 flex items-center gap-2">
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                    swarmhive.com
                  </div>
                </div>
              </div>

              {/* Video Content */}
              <div className="relative">
                <div
                  style={{ padding: '56.25% 0 0 0', position: 'relative' }}
                >
                  <iframe
                    src="https://player.vimeo.com/video/1106242932?badge=0&autopause=0&player_id=0&app_id=58479"
                    frameBorder={0}
                    allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                    }}
                    title="Swarm Demo"
                  />
                </div>
                <script src="https://player.vimeo.com/api/player.js"></script>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}