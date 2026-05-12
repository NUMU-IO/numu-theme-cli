import type { SectionLibraryEntry } from "../index";

export const newsletterSignup: SectionLibraryEntry = {
  slug: "newsletter-signup",
  name: "Newsletter Signup",
  description: "Email capture form with merchant-supplied heading + consent copy",
  component: `import type { SectionProps } from "@numueg/theme-sdk";
import { Form } from "@numueg/theme-sdk";

export default function NewsletterSignup({ settings }: SectionProps) {
  const heading = (settings.heading as string) || "Stay in touch";
  const subheading = (settings.subheading as string) || "";
  const placeholder = (settings.placeholder as string) || "Email address";
  const buttonLabel = (settings.button_label as string) || "Subscribe";
  const consent = (settings.consent_text as string) || "";

  return (
    <section className="py-16 px-6 bg-gray-50">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-2xl md:text-3xl font-semibold">{heading}</h2>
        {subheading && <p className="mt-3 text-gray-600">{subheading}</p>}
        <Form
          action="/api/newsletter/subscribe"
          method="POST"
          className="mt-8 flex flex-col sm:flex-row gap-2 max-w-md mx-auto"
        >
          <input
            type="email"
            name="email"
            required
            placeholder={placeholder}
            aria-label={placeholder}
            className="flex-1 px-4 py-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          <button
            type="submit"
            className="px-6 py-3 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition"
          >
            {buttonLabel}
          </button>
        </Form>
        {consent && <p className="mt-3 text-xs text-gray-500">{consent}</p>}
      </div>
    </section>
  );
}
`,
  schema: {
    type: "newsletter-signup",
    name: "Newsletter Signup",
    locales: { ar: { name: "اشتراك في النشرة" } },
    settings: [
      {
        type: "text",
        id: "heading",
        label: "Heading",
        locales: { ar: { label: "العنوان" } },
        default: "Stay in touch",
      },
      {
        type: "text",
        id: "subheading",
        label: "Subheading",
        locales: { ar: { label: "العنوان الفرعي" } },
      },
      {
        type: "text",
        id: "placeholder",
        label: "Input placeholder",
        locales: { ar: { label: "نص توضيحي" } },
        default: "Email address",
      },
      {
        type: "text",
        id: "button_label",
        label: "Button label",
        locales: { ar: { label: "نص الزر" } },
        default: "Subscribe",
      },
      {
        type: "textarea",
        id: "consent_text",
        label: "Consent / GDPR copy (optional)",
        locales: { ar: { label: "نص الموافقة (اختياري)" } },
      },
    ],
  },
};
