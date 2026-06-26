import type { SectionProps } from "@numueg/theme-sdk";

/**
 * `main.tsx` passes each section component its instance `id` and `type` in
 * addition to the SDK's `SectionProps` (settings/blocks/blockOrder). The SDK
 * type doesn't declare those, so we widen it here — the `id` is what
 * `<EditableText sectionId=…>` / `<EditableImage>` need for inline editing.
 */
export interface EmpSectionProps extends SectionProps {
  id: string;
  type?: string;
}
