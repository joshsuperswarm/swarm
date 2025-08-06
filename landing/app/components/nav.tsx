import Link from "next/link";

const navItems = {
  "/": {
    name: "home",
  },
};

export function Navbar() {
  return (
    <div className="bg-gradient-to-b from-white to-gray-50">
      <nav className="container mx-auto py-8">
        <div className="max-w-3xl mx-auto">
          {Object.entries(navItems).map(([path, { name }]) => {
            return (
              <Link
                key={path}
                href={path}
                className="font-mono text-sm md:text-base text-gray-600 hover:text-black transition-colors mr-4"
              >
                {name}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
