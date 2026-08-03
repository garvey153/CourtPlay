/** Shapes returned by the group RPCs. Kept together so the sheets and the page agree. */

export type GroupRole = "owner" | "member";
export type GroupStatus = "invited" | "active" | "declined" | "removed";

/** A member as it appears in a preview strip — just enough for an avatar. */
export interface GroupPreviewMember {
    id: string;
    first_name: string;
    photo_url: string | null;
}

/** One row from get_my_groups(). */
export interface GroupSummary {
    id: string;
    name: string;
    my_role: GroupRole;
    my_status: GroupStatus;
    invited_at: string;
    member_count: number;
    preview: GroupPreviewMember[];
}

/** A member as it appears on the roster in get_group(). */
export interface GroupMember {
    id: string;
    first_name: string;
    last_name: string | null;
    photo_url: string | null;
    skill_level: string | null;
    role: GroupRole;
    status: GroupStatus;
}

/** get_group() — null when the caller has no access, which the UI treats as "gone". */
export interface GroupDetail {
    id: string;
    name: string;
    created_by: string;
    my_role: GroupRole;
    my_status: GroupStatus;
    members: GroupMember[];
}
