"use client";

import React, { useState } from "react";
import { useForm, ValidationError } from "@formspree/react";

export default function WaitlistForm() {
  const [state, handleSubmit] = useForm("mgvyewbl");
  const [showEmailField, setShowEmailField] = useState(false);

  if (state.succeeded) {
    return (
      <div className="mb-8">
        <button className="bg-white text-black px-6 py-3 text-sm font-medium rounded flex items-center gap-2 cursor-default">
          Signed Up ✓
        </button>
      </div>
    );
  }

  const handleJoinLimitedBeta = (e: React.MouseEvent) => {
    e.preventDefault();
    console.log("Join limited beta clicked"); // Debug log
    setShowEmailField(true);
  };

  return (
    <div className="mb-8">
      {!showEmailField ? (
        <button
          onClick={handleJoinLimitedBeta}
          type="button"
          className="bg-white text-black px-6 py-3 text-sm font-medium hover:bg-gray-100 transition-colors duration-200 cursor-pointer"
        >
          Join the Beta
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div
            className="flex gap-2 opacity-0 animate-fadeIn"
            style={{
              animation: "fadeIn 0.3s ease-in-out forwards",
            }}
          >
            <input
              id="email"
              type="email"
              name="email"
              placeholder="Enter your email"
              required
              autoFocus
              className="flex-1 px-4 py-3 text-sm bg-gray-800 border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:border-gray-500 transition-colors"
            />
            <button
              type="submit"
              disabled={state.submitting}
              className="bg-white text-black px-6 py-3 text-sm font-medium hover:bg-gray-100 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {state.submitting ? "Signing Up..." : "Sign Up"}
            </button>
          </div>
          <ValidationError
            prefix="Email"
            field="email"
            errors={state.errors}
            className="text-red-400 text-xs"
          />
        </form>
      )}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
