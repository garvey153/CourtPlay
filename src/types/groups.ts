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
