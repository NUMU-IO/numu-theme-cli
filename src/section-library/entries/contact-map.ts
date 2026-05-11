import type { SectionLibraryEntry } from "../index";

export const contactMap: SectionLibraryEntry = {
  slug: "contact-map",
  name: "Contact + Map",
  description: "Two-column contact info (address / phone / hours) + embedded map iframe",
  component: `import type { SectionProps } from "@numu/theme-sdk";

export default function ContactMap({ settings }: SectionProps) {
  const heading = (settings.heading as string) || "Visit us";
  const address = (settings.address as string) || "";
  const phone = (settings.phone as string) || "";
  const hours = (settings.hours as string) || "";
  const mapUrl = (settings.map_url as string) || "";

  return (
    <section className="py-16 px-6 max-w-7xl mx-auto">
      <h2 className="text-2xl md:text-3xl font-semibold mb-10 text-center">{heading}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="space-y-6">
          {address && (
            <div>
              <h3 className="font-semibold mb-1">Address</h3>
              <p className="text-gray-700 whitespace-pre-line">{address}</p>
            </div>
          )}
          {phone && (
            <div>
              <h3 className="font-semibold mb-1">Phone</h3>
              <a href={\`tel:\${phone}\`} className="text-blue-700 hover:underline">{phone}</a>
            </div>
          )}
          {hours && (
            <div>
              <h3 className="font-semibold mb-1">Hours</h3>
              <p className="text-gray-700 whitespace-pre-line">{hours}</p>
            </div>
          )}
        </div>
        <div className="aspect-square md:aspect-auto bg-gray-100 rounded-lg overflow-hidden">
          {mapUrl ? (
            <iframe
              src={mapUrl}
              title="Map"
              loading="lazy"
              className="w-full h-full border-0"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">Set a map embed URL</div>
          )}
        </div>
      </div>
    </section>
  );
}
`,
  schema: {
    type: "contact-map",
    name: "Contact + Map",
    locales: { ar: { name: "تواصل وخريطة" } },
    settings: [
      { type: "text", id: "heading", label: "Heading", default: "Visit us" },
      { type: "textarea", id: "address", label: "Address" },
      { type: "text", id: "phone", label: "Phone" },
      { type: "textarea", id: "hours", label: "Hours" },
      { type: "url", id: "map_url", label: "Map embed URL (Google Maps / OSM)" },
    ],
  },
};
