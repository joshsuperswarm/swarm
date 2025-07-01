import Image from "next/image";
import { BlogPosts } from "app/components/posts";
import WaitlistForm from "app/components/waitlist-form";

export default function Page() {
  return (
    <div className="min-h-screen bg-[#1B1F24] text-[#EAEAEA] font-sans">
      {/* Video Section - Full Width at Top */}
      <div className="w-full px-8 pt-16">
        <div className="max-w-4xl mx-auto">
          <div className="w-full rounded-lg overflow-hidden">
            <div style={{ padding: "56.25% 0 0 0", position: "relative" }}>
              <iframe
                src="https://player.vimeo.com/video/1090329768?h=a0ea69c02d&badge=0&autopause=0&player_id=0&app_id=58479&muted=0"
                frameBorder="0"
                allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                }}
                title="Engines Demo"
              />
            </div>
            <script src="https://player.vimeo.com/api/player.js"></script>
          </div>
        </div>
      </div>

      {/* Logo and Content Section */}
      <div className="flex justify-center min-h-[60vh] px-8 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Desktop Layout: Logo on Left, Content on Right */}
          <div className="hidden md:flex gap-16">
            {/* Logo on Left */}
            <div className="flex-shrink-0">
              <Image
                src="/Engines Dev Logo Cropped.png"
                alt="Engines"
                width={400}
                height={400}
                priority
                className=""
              />
            </div>

            {/* Content on Right */}
            <div className="flex-1 max-w-2xl flex flex-col justify-start">
              {/* Main headline */}
              <h1 className="text-4xl md:text-5xl font-light mb-6 leading-tight tracking-tight -mt-4">
                Setup any repo with one command.
              </h1>

              {/* Description */}
              <p className="text-lg text-gray-400 mb-8 leading-relaxed font-light">
                Engines is an AI platform engineer that containerizes codebases,
                debugs Terraform code, and helps you get complex monorepos
                setup.{" "}
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

              {/* Y Combinator Badge */}
              <div className="flex items-center gap-2 text-gray-400">
                <span className="text-sm font-light">Backed by</span>
                <Image
                  src="/Y Combinator.svg"
                  alt="Y Combinator"
                  width={120}
                  height={30}
                  className="opacity-80"
                />
              </div>
            </div>
          </div>

          {/* Mobile Layout: Single Column */}
          <div className="md:hidden flex flex-col">
            {/* Logo */}
            <div className="mb-8">
              <Image
                src="/Engines Dev Logo Cropped.png"
                alt="Engines"
                width={300}
                height={300}
                priority
                className=""
              />
            </div>

            {/* Content */}
            <div className="max-w-lg">
              {/* Main headline */}
              <h1 className="text-3xl font-light mb-6 leading-tight tracking-tight">
                Setup any repo with one command.
              </h1>

              {/* Description */}
              <p className="text-base text-gray-400 mb-8 leading-relaxed font-light">
                Engines is an AI platform engineer that containerizes codebases,
                debugs Terraform code, and helps you get complex monorepos
                setup.{" "}
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
              <div className="mb-8">
                <WaitlistForm />
              </div>

              {/* Y Combinator Badge */}
              <div className="flex items-center gap-2 text-gray-400">
                <span className="text-sm font-light">Backed by</span>
                <Image
                  src="/Y Combinator.svg"
                  alt="Y Combinator"
                  width={120}
                  height={30}
                  className="opacity-80"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
