"use client";

import * as typeformEmbed from "@typeform/embed";
import "@typeform/embed/build/css/popup.css";
import React from "react";

export default function WaitlistForm() {
  const handleClick = () => {
    typeformEmbed.createPopup("https://form.typeform.com/to/jLQhyODl", {
      autoClose: 3,
      hideHeaders: true,
      hideFooter: true,
      opacity: 100,
      onSubmit: () => console.log("Form submitted"),
    }).open();
  };

  return (
    <button
      onClick={handleClick}
      className="px-6 py-3 text-sm font-medium transition-colors duration-200 cursor-pointer h-[48px]"
      style={{
        backgroundColor: "#7dd3fc",
        color: "#0f172a",
        borderRadius: "8px",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.backgroundColor = "#60a5fa")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.backgroundColor = "#7dd3fc")
      }
    >
      Join the Beta
    </button>
  );
}