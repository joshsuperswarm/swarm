import React from 'react';

// Mock router for video - doesn't need actual routing
export const MockRouter: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <div>{children}</div>;
};