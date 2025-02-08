"use client";
import React from "react";
import { useSession } from "@/app/layout";

const LoginButton: React.FC = () => {
  const { session, setSession } = useSession();

  const handleLogin = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE}/auth/login`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        }
      );
      if (!response.ok) {
        throw new Error(`Login failed: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.session) {
        throw new Error("No session data received from server");
      }

      // セッション状態を更新
      setSession(data.session);
    } catch (error) {
      console.error("Login error:", error);
      setSession(null);
    }
  };

  const handleLogout = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE}/auth/logout`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        }
      );
      if (!response.ok) {
        throw new Error(`Logout failed: ${response.statusText}`);
      }

      // セッション状態をクリア
      setSession(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <div className="fixed top-0 w-svw h-svh pointer-events-none z-50">
      <div className="absolute top-[2%] right-[5%] pointer-events-auto">
        <button
          onClick={session ? handleLogout : handleLogin}
          className={`px-4 py-2 rounded transition-colors duration-300 ${
            session
              ? "bg-red-500 hover:bg-red-700"
              : "bg-blue-500 hover:bg-blue-700"
          } text-white`}
        >
          {session ? "Log Out" : "Log In"}
        </button>
      </div>
    </div>
  );
};

export default LoginButton;
