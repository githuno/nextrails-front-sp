import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const JAPAN_IP_RANGES = [
  ["133.200.0.0", "133.203.255.255"],
  ["133.205.0.0", "133.208.255.255"],
  ["133.209.0.0", "133.211.255.255"],
];

function ipToNumber(ip: string): number {
  return (
    ip
      .split(".")
      .reduce((num, octet) => (num << 8) + parseInt(octet, 10), 0) >>> 0
  );
}

function isJapaneseIP(ip: string): boolean {
  const ipNum = ipToNumber(ip);
  return JAPAN_IP_RANGES.some(([start, end]) => {
    const startNum = ipToNumber(start);
    const endNum = ipToNumber(end);
    return ipNum >= startNum && ipNum <= endNum;
  });
}

function getClientIP(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    request.headers.get("x-real-ip") ||
    request.ip ||
    "133.200.1.1"
  );
}

export function middleware(request: NextRequest) {
  // radikoのAPIエンドポイントへのリクエストのみを処理
  if (!request.nextUrl.pathname.startsWith("/api/proxy/radiko")) {
    return NextResponse.next();
  }

  const clientIP = getClientIP(request);
  const isJapanese = isJapaneseIP(clientIP);

  // 本番環境でJP以外のIPからのアクセスを制限
  if (process.env.NODE_ENV === "production" && !isJapanese) {
    return NextResponse.json(
      { error: "Access denied: Non-Japanese IP address" },
      { status: 403 }
    );
  }

  // ヘッダーを設定してリクエストを続行
  const response = NextResponse.next();
  response.headers.set("x-client-ip", clientIP);
  response.headers.set("x-client-region", "JP");

  return response;
}

export const config = {
  matcher: "/api/proxy/radiko/:path*",
};
