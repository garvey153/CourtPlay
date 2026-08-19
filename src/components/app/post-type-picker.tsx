import { cx } from "@/utils/cx";
import { FieldLabel } from "@/components/base/input/field-label";

export type PostTypeId = "sub_need" | "regular_game";

/**
 * The two things you can post, as radio cards.
 *
 * Extracted from post-new.tsx so the tutorial can show the real control rather
 * than a copy of its markup — a copy would drift silently, which is exactly
 * what the screenshot fingerprint test cannot protect against.
 */
export const POST_TYPES: Array<{ id: PostTypeId; title: string; desc: string }> = [
    {
        id: "sub_need",
        title: "Find a sub",
        desc: "Post a specific date, time, and court to fill an open spot and recoup the cost.",
    },
    {
        id: "regular_game",
        title: "Find a regular game",
        desc: "Post your availability and preferences to connect with ongoing groups.",
    },
];

export function PostTypePicker({ value, onChange }: { value: PostTypeId; onChange: (id: PostTypeId) => void }) {
    return (
        <div className="mb-7 flex flex-col gap-3">
            <FieldLabel required>Select a post type</FieldLabel>
            {POST_TYPES.map((t) => {
                const selected = value === t.id;
                return (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => onChange(t.id)}
                        className={cx(
                            // Always border-2 (color-only change) so the card's inner width — and
                            // therefore the description wrapping — stays constant when toggling.
                            "flex items-start gap-2 rounded-lg border-2 bg-tertiary p-4 text-left transition duration-100 ease-linear",
                            selected ? "border-brand" : "border-neutral-600 hover:border-neutral-500",
                        )}
                    >
                        <span
                            className={cx(
                                "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full",
                                selected ? "bg-brand-solid" : "border border-neutral-600",
                            )}
                        >
                            {selected && <span className="size-1.5 rounded-full bg-white" />}
                        </span>
                        <span className="flex min-w-0 flex-col">
                            <span className="text-sm font-medium text-primary">{t.title}</span>
                            <span className="text-sm text-secondary">{t.desc}</span>
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
