import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { urlOrSlug } = await req.json();

    if (!urlOrSlug) {
      return NextResponse.json({ error: "Missing url or slug" }, { status: 400 });
    }

    // Extract title slug
    let titleSlug = urlOrSlug.trim();
    
    // Check if it's a URL
    try {
      const parsedUrl = new URL(titleSlug);
      if (parsedUrl.hostname.includes('leetcode.com')) {
        const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
        const problemsIndex = pathParts.indexOf('problems');
        if (problemsIndex !== -1 && pathParts.length > problemsIndex + 1) {
          titleSlug = pathParts[problemsIndex + 1];
        } else {
          return NextResponse.json({ error: "Invalid LeetCode URL format" }, { status: 400 });
        }
      }
    } catch (e) {
      // Not a URL, assume it's just the slug
    }

    // Query LeetCode GraphQL API
    const response = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Referer": "https://leetcode.com",
      },
      body: JSON.stringify({
        query: `
          query getQuestionDetail($titleSlug: String!) {
            question(titleSlug: $titleSlug) {
              title
              difficulty
              questionFrontendId
            }
          }
        `,
        variables: {
          titleSlug,
        },
      }),
    });

    const data = await response.json();

    if (data.errors || !data.data || !data.data.question) {
      return NextResponse.json({ error: "Problem not found or API error" }, { status: 404 });
    }

    return NextResponse.json({
      titleSlug,
      title: data.data.question.title,
      difficulty: data.data.question.difficulty,
      id: data.data.question.questionFrontendId,
    });
  } catch (error) {
    console.error("LeetCode API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
