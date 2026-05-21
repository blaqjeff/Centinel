import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET() {
  try {
    const res = await fetch("https://api.github.com/repos/blaqjeff/Centinel", {
      headers: {
        "User-Agent": "Centinel-Docs-Website",
      },
      next: { revalidate: 1800 }, // Cache for 30 minutes in Next.js
    });

    if (!res.ok) {
      throw new Error(`GitHub API returned status ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json({ stars: data.stargazers_count || 0 });
  } catch (error: any) {
    console.error("Error fetching GitHub stars:", error);
    // Safe fallback
    return NextResponse.json({ stars: null, error: error.message }, { status: 500 });
  }
}
