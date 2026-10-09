import { createClient } from "@/lib/supabase/server";
import { LibraryView } from "./LibraryView";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("exercises").select("slug, name, muscle_group, kit, muscles, setup, cues, mistakes").order("sort_order");
  if (error || !data) {
    return (
      <div className="scroll">
        <div className="empty" style={{ paddingTop: "var(--space-12)" }}>
          <h1 className="t-title">Can’t load the library</h1>
          <p className="t-body c-2">Check your connection and try again.</p>
        </div>
      </div>
    );
  }
  return <LibraryView items={data.map((e) => ({ slug: e.slug, name: e.name, group: e.muscle_group, kit: e.kit, muscles: e.muscles, setup: e.setup, cues: e.cues, mistakes: e.mistakes }))} />;
}
