import { type ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/lib/supabase";

interface ProtectedRouteProps {
    children: ReactNode;
    adminOnly?: boolean;
    skipProfileCheck?: boolean;
}

export function ProtectedRoute({ children, adminOnly = false, skipProfileCheck = false }: ProtectedRouteProps) {
    const { user, loading: authLoading } = useAuth();
    const { profile, loading: profileLoading } = useProfile();
    const location = useLocation();

    // Fresh admin check — queries DB on every load, not cached state
    const [adminVerified, setAdminVerified] = useState<boolean | null>(adminOnly ? null : true);
    const [adminChecking, setAdminChecking] = useState(adminOnly);

    useEffect(() => {
        if (!adminOnly || !user) return;

        let cancelled = false;
        setAdminChecking(true);
        setAdminVerified(null);

        supabase
            .from("users")
            .select("is_admin")
            .eq("id", user.id)
            .single()
            .then(({ data }) => {
                if (!cancelled) {
                    setAdminVerified(data?.is_admin === true);
                    setAdminChecking(false);
                }
            });

        return () => { cancelled = true; };
    }, [adminOnly, user, location.pathname]);

    if (authLoading || profileLoading || adminChecking) {
        return (
            <div className="flex h-dvh items-center justify-center">
                <div className="size-8 animate-spin rounded-full border-2 border-border-secondary border-t-brand-solid" />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/signin" replace />;
    }

    // New user with no profile — send to onboarding (unless already there)
    if (!skipProfileCheck && !profile && location.pathname !== "/onboarding") {
        return <Navigate to="/onboarding" replace />;
    }

    if (adminOnly && !adminVerified) {
        return <Navigate to="/feed" replace />;
    }

    return <>{children}</>;
}
