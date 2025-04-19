"use client";

import React, { createContext, useContext, useRef } from "react";
import { EmitterSingleton, EventEmitter } from "./EventEmitter";

// Create the Context
const EventEmitterContext = createContext<EventEmitter | null>(null);

// Provider Component
export const EventEmitterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const eventEmitterRef = useRef(EmitterSingleton);

  return (
    <EventEmitterContext.Provider value={eventEmitterRef.current}>
      {children}
    </EventEmitterContext.Provider>
  );
};

// Hook to use the EventEmitter
export const useEventEmitter = (): EventEmitter => {
  const context = useContext(EventEmitterContext);
  if (!context) {
    throw new Error("useEventEmitter must be used within an EventEmitterProvider");
  }
  return context;
};
