import { SignIn } from "@clerk/clerk-react";

export function LoginPage() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900 mb-12">Swarm</h1>
        <div className="max-w-md mx-auto">
          <SignIn />
        </div>
      </div>
    </div>
  );
}