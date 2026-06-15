"use client";

import { useState } from "react";

export function FlaggedNav({ count, flaggedIds }: { count: number; flaggedIds: string[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (count === 0 || flaggedIds.length === 0) return null;

  function scrollToNext() {
    const nextIndex = (currentIndex + 1) % flaggedIds.length;
    const element = document.getElementById(flaggedIds[currentIndex]);
    if (element) {
      // Find the scrollable container and calculate position
      const container = document.getElementById("transcript-scroll");
      if (container) {
        // Calculate relative position within the scroll container
        const containerRect = container.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        
        // Scroll container to the element, subtracting a bit for some top padding
        container.scrollTo({
          top: container.scrollTop + (elementRect.top - containerRect.top) - 20,
          behavior: "smooth"
        });
        
        // Temporarily highlight the element
        element.style.transition = "outline 0.2s ease";
        element.style.outline = "2px solid var(--crit)";
        element.style.outlineOffset = "2px";
        setTimeout(() => {
          element.style.outline = "none";
        }, 1500);
      }
    }
    
    setCurrentIndex(nextIndex);
  }

  return (
    <button 
      onClick={scrollToNext}
      className="badge badge-crit transition-transform hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-1"
      title="Click to jump to next error"
    >
      <span>{count} flagged</span>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9l6 6 6-6"/>
      </svg>
    </button>
  );
}
