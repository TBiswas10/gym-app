// The id of the build being served. The app compares it with the one it was built with.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ build: process.env.NEXT_PUBLIC_BUILD_ID ?? "" }, { headers: { "cache-control": "no-store" } });
}
