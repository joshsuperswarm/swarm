import Image from 'next/image';
import WaitlistForm from 'app/components/waitlist-form';
import Footer from 'app/components/footer';

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
      <div className="mx-auto px-6 md:px-8">
        {/* Text Section */}
        <div className="mx-auto max-w-[70rem] pt-[14vh] md:pt-[16vh] pb-4 md:pb-5">
          {/* Logo */}
          <div className="flex justify-center mb-8 md:mb-9">
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
          <h1
            className="
              mx-auto max-w-[20ch] md:max-w-[22ch]
              text-center font-light tracking-tight
              text-[clamp(28px,3.2vw,44px)]
              leading-[1.12] md:leading-[1.10]
              mb-4 md:mb-5
            "
            style={{ textWrap: 'balance' }}
          >
            The code planning interface
          </h1>

          {/* Subheadline */}
          <div className="mx-auto max-w-[56ch] text-center mb-6 md:mb-7">
            <p className="text-[clamp(14px,1.1vw,17px)] text-gray-300/85 leading-relaxed">
              AI coding tools for the uncompromising developer.
            </p>
          </div>

          {/* CTA Buttons */}
          <div
            id="waitlist"
            className="
              flex flex-col sm:flex-row items-center justify-center
              gap-3 md:gap-3.5 mt-3.5 mb-1.5 md:mb-2
            "
          >
            <WaitlistForm />
            <a
              href="https://twitter.com/jmvldz"
              target="_blank"
              rel="noopener noreferrer"
              className="
                inline-flex items-center gap-2
                h-[48px] px-5 md:px-6 rounded-md text-sm
                bg-transparent border border-gray-600 text-gray-300
                hover:border-gray-400 hover:text-white transition-all
              "
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
        </div>

        {/* Media Section */}
        <div className="relative mx-auto w-full md:w-1/2 max-w-[48rem] mt-2 md:mt-3 lg:mt-4 px-0 md:px-2">
          <div className="relative rounded-xl overflow-hidden">
            <div style={{ padding: '56.25% 0 0 0', position: 'relative' }}>
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
        <Footer />
      </div>
    </div>
  );
}