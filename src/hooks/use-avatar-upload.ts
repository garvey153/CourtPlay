import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { describeActionError } from "@/utils/load-error";

/**
 * Picking, positioning and storing a profile photo.
 *
 * Shared by onboarding and Manage because the storage path is not a detail
 * either of them should be repeating. The bucket's policy is
 *
 *     auth.uid()::text = (storage.foldername(name))[1]
 *
 * so the user's id has to be the FOLDER. Both screens had it as part of the
 * filename instead, under a path the check could never pass, and both failed
 * silently — the photo simply never changed. One copy of that knowledge now.
 *
 * The caller owns the cropper: this returns the picked file while it is being
 * positioned, and takes the square JPEG the cropper produces.
 */
export function useAvatarUpload(userId: string | undefined, onUploaded: (url: string, blob: Blob) => void) {
    /** The picked file, while it is being positioned. Null when no cropper is open. */
    const [cropping, setCropping] = useState<File | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /** Wire to the file input's onChange. */
    const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        // Clear the input so picking the SAME photo again still fires a change
        // event — otherwise a failure could not be retried without choosing
        // something else first.
        e.target.value = "";
        if (!file) return;
        setError(null);
        setCropping(file);
    };

    /** Wire to the cropper's onConfirm. */
    const upload = async (blob: Blob) => {
        if (!userId) return;
        setError(null);
        setBusy(true);
        try {
            const path = `${userId}/avatar.jpg`;
            const { error: upErr } = await supabase.storage
                .from("avatars")
                .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
            if (upErr) throw upErr;

            const { data } = supabase.storage.from("avatars").getPublicUrl(path);
            // Cache-bust on the clock, not the file's size: two different photos
            // can share a size, and re-picking one would show the cached image.
            onUploaded(`${data.publicUrl}?t=${Date.now()}`, blob);
            setCropping(null);
        } catch (err) {
            console.error("avatar upload failed:", err);
            setError(describeActionError(err, "update your photo"));
        } finally {
            setBusy(false);
        }
    };

    return { cropping, busy, error, pick, upload, cancel: () => setCropping(null) };
}
