import { NextRequest, NextResponse } from "next/server";
import { listVideos, saveVideo } from "../../../lib/specs";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ videos: listVideos() });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.spec) {
    return NextResponse.json({ error: "Body must be { name?, spec }" }, { status: 400 });
  }
  const name = body.name ?? body.spec.title ?? "untitled";
  const result = saveVideo(name, body.spec);
  if (!result.ok) {
    if ("readonly" in result && result.readonly) {
      return NextResponse.json(
        { error: "The hosted library is read-only. Run the studio locally to save videos." },
        { status: 501 }
      );
    }
    return NextResponse.json({ error: "Invalid spec", issues: result.error }, { status: 422 });
  }
  return NextResponse.json({ saved: result.name });
}
