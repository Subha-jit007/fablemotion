import { NextRequest, NextResponse } from "next/server";
import { getVideo } from "../../../../lib/specs";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const spec = getVideo(name);
  if (!spec) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ spec });
}
