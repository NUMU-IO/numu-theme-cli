/**
 * Every section instance a theme.json places through its presets — both
 * `presets.templates` and `presets.section_groups`. A bucket entry's
 * `sections` is an array of instances (every real theme + the scaffold) or
 * an id → instance map; `id` is the array index or the map key.
 */
export interface PresetSection {
  bucket: "templates" | "section_groups";
  preset: string;
  id: string;
  section: { type?: string; settings?: Record<string, unknown> };
}

export function presetSections(
  manifest: Record<string, unknown>,
): PresetSection[] {
  const out: PresetSection[] = [];
  const presets = (manifest.presets as Record<string, unknown>) || {};
  for (const bucket of ["templates", "section_groups"] as const) {
    const entries = presets[bucket];
    if (!entries || typeof entries !== "object") continue;
    for (const [preset, entry] of Object.entries(entries)) {
      const sections = (entry as { sections?: unknown } | null)?.sections;
      const pairs = Array.isArray(sections)
        ? sections.map((s, i) => [String(i), s] as const)
        : sections && typeof sections === "object"
          ? Object.entries(sections)
          : [];
      for (const [id, section] of pairs) {
        if (section && typeof section === "object")
          out.push({ bucket, preset, id, section });
      }
    }
  }
  return out;
}
