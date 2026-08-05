/** Shapes returned by the group RPCs. Shared by the Profile section and the sheets. */

/** A member as returned by get_my_groups — enough for the avatar strip and the "& 2 more" line. */
export interface GroupMemberBrief {
    id: string;
    first_name: string;
    last_name: string | null;
    photo_url: string | null;
}

/** One row from get_my_groups(). */
export interface GroupSummary {
    id: string;
    name: string;
    /** The "Westport Social League" line. Optional. */
    details: string | null;
    is_creator: boolean;
    /** Closed by its creator: still listed, rendered void, until you remove it. */
    is_closed: boolean;
    /** When the group was closed, or null while it is open. Drives the feed banner. */
    closed_at: string | null;
    /** When the caller joined. Drives the "you were added" feed banner. */
    joined_at: string;
    /**
     * Set when the caller was removed. get_my_groups returns removals from the
     * last 30 days purely so the feed can say so — anything listing groups you
     * are actually IN must filter these out.
     */
    my_removed_at: string | null;
    member_count: number;
    members: GroupMemberBrief[];
}

/** A roster row from get_group(). */
export interface GroupMember extends GroupMemberBrief {
    skill_level: string | null;
    is_creator: boolean;
}

/** get_group() — null when the caller is not a member, which the UI treats as gone. */
export interface GroupDetail {
    id: string;
    name: string;
    details: string | null;
    created_by: string;
    is_creator: boolean;
    is_closed: boolean;
    members: GroupMember[];
}

/** "Chris B, Sara H., & 2 more" — the member line under a group name. */
export function describeMembers(members: GroupMemberBrief[], shown = 2): string {
    if (members.length === 0) return "No players yet";
    const label = (m: GroupMemberBrief) =>
        `${m.first_name}${m.last_name ? ` ${m.last_name.charAt(0)}.` : ""}`;
    const named = members.slice(0, shown).map(label);
    const rest = members.length - named.length;
    if (rest <= 0) return named.join(", ");
    return `${named.join(", ")}, & ${rest} more`;
}
