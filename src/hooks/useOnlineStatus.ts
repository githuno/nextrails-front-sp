import { useSyncExternalStore } from "react"

// 1️⃣ Subscribe to browser online/offline events
function subscribe(callback: () => void) {
  window.addEventListener("online", callback)
  window.addEventListener("offline", callback)

  return () => {
    window.removeEventListener("online", callback)
    window.removeEventListener("offline", callback)
  }
}

// 2️⃣ Snapshot getter
function getSnapshot() {
  return navigator.onLine
}

// 3️⃣ Optional SSR fallback
function getServerSnapshot() {
  return true // assume online on the server
}

// 4️⃣ Our custom hook
export function useOnlineStatus() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/**
 * 
import React from "react";
import { useOnlineStatus } from "./useOnlineStatus";

export default function NetworkStatus() {
  const isOnline = useOnlineStatus();

  return (
    <div
      style={{
        padding: "2rem",
        textAlign: "center",
        fontFamily: "sans-serif",
      }}
    >
      <h1>
        You are currently:{" "}
        <span style={{ color: isOnline ? "green" : "red" }}>
          {isOnline ? "Online" : "Offline"}
        </span>
      </h1>
    </div>
  );
}
 */
