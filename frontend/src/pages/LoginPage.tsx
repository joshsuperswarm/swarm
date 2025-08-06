import { SignIn } from "@clerk/clerk-react";

export function LoginPage() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="max-w-md mx-auto">
          <SignIn />
        </div>
      </div>
    </div>
  );
}