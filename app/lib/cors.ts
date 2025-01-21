import { type NextRequest, NextResponse } from "next/server"

export async function cors(req: NextRequest) {
  const origin = req.headers.get("origin")

  if (origin) {
    return new NextResponse(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    })
  }

  return new NextResponse(null, { status: 200 })
}

