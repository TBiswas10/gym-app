/** OAuth protected-resource metadata (RFC 9728): tells a connector that Supabase Auth is the sign-in server. */
export function protectedResourceMetadata(origin: string) {
  return {
    resource: `${origin}/mcp`,
    authorization_servers: [`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1`],
    bearer_methods_supported: ["header"],
    resource_name: "Workout Tracker",
  };
}
