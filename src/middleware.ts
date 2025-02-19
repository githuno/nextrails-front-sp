import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 開発環境でのIPアドレス
const DEV_IP = "127.0.0.1";

// クライアントのタイムゾーン情報を取得
function getClientJSTTime(): string {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  const jst = new Date(utc + 9 * 60 * 60 * 1000);
  return jst.toISOString();
}

// クライアントIPを取得して検証
function validateAndGetClientIP(request: NextRequest): string {
  // 本番環境（Vercel）での処理
  if (process.env.VERCEL) {
    return (
      request.headers.get("x-real-ip") ||
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.ip ||
      DEV_IP
    );
  }

  // 開発環境での処理
  return DEV_IP;
}

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/api/proxy/radiko")) {
    return NextResponse.next();
  }

  const clientIP = validateAndGetClientIP(request);
  const response = NextResponse.next();

  // 共通のヘッダー設定
  response.headers.set("x-client-ip", clientIP);
  response.headers.set("x-client-jst-time", getClientJSTTime());
  response.headers.set("x-client-area", process.env.VERCEL ? "JP13" : "JP13");
  response.headers.set("x-client-timezone", "Asia/Tokyo");

  // radikoの認証に必要な追加ヘッダー
  if (request.nextUrl.pathname.includes("/api/auth")) {
    response.headers.set("x-radiko-user", "dummy_user");
    response.headers.set("x-radiko-device", "pc");
  }

  return response;
}

export const config = {
  matcher: "/api/proxy/radiko/:path*",
};
