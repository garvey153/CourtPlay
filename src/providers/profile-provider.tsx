import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";

export interface UserProfile {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    headline: string | null;
    photo_url: string | null;
    skill_level: string | null;
    court_preferences: string[] | null;
    pro_preference: string | null;
    new_to_westport: boolean;
    is_admin: boolean;
    onesignal_player_id: string | null;
}

interface ProfileContextValue {
    profile: UserProfile | null;
    loading: boolean;
    setProfile: (p: UserProfile | null) => void;
    refreshProfile: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue>({
    profile: null,
    loading: true,
    setProfile: () => {},
    refreshProfile: async () => {},
});

export function ProfileProvider({ children }: { children: ReactNode }) {
    const { user, loading: authLoading } = useAuth();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchProfile = useCallback(async (userId: string) => {
        setLoading(true);
        const { data } = await supabase
            .from("users")
            .select("*")
            .eq("id", userId)
            .maybeSingle();
        setProfile(data);
        setLoading(false);
    }, []);

    useEffect(() => {
        // Wait for auth to fully resolve before doing anything
        if (authLoading) return;

        if (!user) {
            setProfile(null);
            setLoading(false);
            return;
        }

        fetchProfile(user.id);
    }, [user, authLoading, fetchProfile]);

    const refreshProfile = useCallback(async () => {
        if (!user) return;
        await fetchProfile(user.id);
    }, [user, fetchProfile]);

    return (
        <ProfileContext.Provider value={{ profile, loading, setProfile, refreshProfile }}>
            {children}
        </ProfileContext.Provider>
    );
}

export function useProfile() {
    return useContext(ProfileContext);
}
