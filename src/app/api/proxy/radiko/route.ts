import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

// Runtime設定
export const runtime = "edge";
export const preferredRegion = "hnd1";
export const dynamic = "force-dynamic";

const RADIKO_BASE_URL = "https://radiko.jp";

// 基本ヘッダー設定
const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Origin: "https://radiko.jp",
  Referer: "https://radiko.jp/",
  "X-Radiko-App": "pc_html5",
  "X-Radiko-App-Version": "0.0.1",
  "X-Radiko-User": "dummy_user",
  "X-Radiko-Device": "pc",
} as const;

// エラーレスポンス生成関数
function createErrorResponse(status: number, message: string) {
  return NextResponse.json(
    {
      error: message,
      timestamp: new Date().toISOString(),
      timezone: "Asia/Tokyo",
    },
    {
      status,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}

export async function GET(request: NextRequest) {
  try {
    const headersList = headers();
    const clientIP = headersList.get("x-client-ip");
    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get("path");

    if (!path) {
      return createErrorResponse(400, "Path parameter is required");
    }

    if (!clientIP) {
      return createErrorResponse(403, "Client IP not found");
    }

    // リクエストヘッダーの構築
    const radikoHeaders = {
      ...DEFAULT_HEADERS,
      ...JSON.parse(searchParams.get("headers") || "{}"),
      "X-Forwarded-For": clientIP,
      "X-Real-IP": clientIP,
      "Accept-Encoding": "gzip, deflate",
      Date: new Date().toUTCString(),
      "Time-Zone": "Asia/Tokyo",
    };

    // radikoへのリクエストURL構築
    const url = path.startsWith("http")
      ? path
      : new URL(path, RADIKO_BASE_URL).toString();

    // radikoへのリクエスト実行
    const response = await fetch(url, {
      method: "GET",
      headers: radikoHeaders,
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return createErrorResponse(
        response.status,
        `Radiko API error: ${response.status}`
      );
    }

    // レスポンスの構築
    const data = await response.arrayBuffer();
    const responseHeaders = new Headers({
      "Content-Type":
        response.headers.get("Content-Type") || "application/octet-stream",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Cache-Control": "no-store",
    });

    // Radikoの認証関連ヘッダーを転送
    ["x-radiko-authtoken", "x-radiko-keyoffset", "x-radiko-keylength"].forEach(
      (header) => {
        const value = response.headers.get(header);
        if (value) responseHeaders.set(header, value);
      }
    );

    return new NextResponse(data, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Radiko proxy error:", error);
    return createErrorResponse(
      500,
      error instanceof Error ? error.message : "Internal Server Error"
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Max-Age": "86400",
    },
  });
}
