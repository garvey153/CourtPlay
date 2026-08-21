import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { ProfileContext } from "@/providers/profile-provider";
import { DEMO_PROFILE } from "./fixtures";
import { SCREEN_ROUTES } from "./screens";
import { setDemoScreen } from "./supabase-mock";

/**
 * The context every demo screen renders inside.
 *
 * Used by BOTH the browser capture entry and the jsdom fingerprint test — that
 * is the whole point. If they rendered different trees, the fingerprint would
 * be policing something the screenshot never showed.
 *
 * The profile is injected directly rather than fetched, so nothing here touches
 * the network and the screens are identical on every run.
 */
export function DemoProviders({ children, screen }: { children: ReactNode; screen?: string }) {
    // Before the children render, so the first fetch already sees it. An effect
    // would land after the page had asked and been answered wrongly.
    setDemoScreen(screen ?? null);

    return (
        <MemoryRouter initialEntries={[(screen && SCREEN_ROUTES[screen]) || "/"]}>
            <ProfileContext.Provider
                value={{
                    profile: DEMO_PROFILE,
                    loading: false,
                    setProfile: () => {},
                    refreshProfile: async () => {},
                }}
            >
                {children}
            </ProfileContext.Provider>
        </MemoryRouter>
    );
}
