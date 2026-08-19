import type { ReactNode } from "react";

/**
 * The label above a field in the post form.
 *
 * Lifted out of post-new.tsx when the post-type picker became its own
 * component — both need it, and a second copy would be one more thing to keep
 * in sync by hand.
 */
export function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
    return (
        <label className="text-sm font-medium text-secondary">
            {children}
            {required && <span> *</span>}
        </label>
    );
}
