import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const targetUrl = searchParams.get("url")

  if (!targetUrl) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 })
  }

  try {
    const response = await fetch(targetUrl)
    const contentType = response.headers.get("content-type")

    const headers = new Headers(response.headers)
    headers.delete("x-frame-options") // X-Frame-Optionsヘッダーを削除

    const body = await response.text()

    return new NextResponse(body, {
      headers: {
        "content-type": contentType || "text/html",
      },
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch the URL" }, { status: 500 })
  }
}
