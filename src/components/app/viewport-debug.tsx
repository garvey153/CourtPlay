import { useEffect, useRef, useState } from "react";

/**
 * TEMPORARY viewport instrumentation for the installed-iOS bottom-nav bug.
 * Opt-in via localStorage `cs_vp_debug` = "1" (toggle by tapping the Version
 * stamp on Profile). Shows viewport metrics frozen at mount vs live, so the
 * login → feed first paint can be compared against the post-swipe state.
 * Remove once the bug is understood.
 */
interface Snap {
    iH: number; // window.innerHeight
    vvH: number; // visualViewport height
    vvTop: number; // visualViewport offsetTop
    dvh: number; // rendered height of a 100dvh element
    cH: number; // documentElement.clientHeight
    sc: number; // screen.height
    sab: number; // resolved env(safe-area-inset-bottom)
    shell: number; // app shell (h-dvh) rendered height
    navB: number; // bottom nav's rect.bottom
    gap: number; // iH - navB (px the nav bottom sits above the viewport bottom)
}

function read(): Snap {
    const vv = window.visualViewport;
    const iH = Math.round(window.innerHeight);
    const shellEl = document.querySelector("[data-app-shell]") as HTMLElement | null;
    const navEl = document.querySelector("nav") as HTMLElement | null;
    const sabEl = document.getElementById("vp-sab-probe");
    const dvhEl = document.getElementById("vp-dvh-probe");
    const navB = navEl ? Math.round(navEl.getBoundingClientRect().bottom) : 0;
    return {
        iH,
        vvH: vv ? Math.round(vv.height) : 0,
        vvTop: vv ? Math.round(vv.offsetTop) : 0,
        dvh: dvhEl ? Math.round(dvhEl.getBoundingClientRect().height) : 0,
        cH: Math.round(document.documentElement.clientHeight),
        sc: Math.round(window.screen.height),
        sab: sabEl ? Math.round(parseFloat(getComputedStyle(sabEl).paddingBottom) || 0) : 0,
        shell: shellEl ? Math.round(shellEl.getBoundingClientRect().height) : 0,
        navB,
        gap: iH - navB,
    };
}

const fmt = (s: Snap | null) =>
    s
        ? `iH${s.iH} vv${s.vvH}@${s.vvTop} dvh${s.dvh} cH${s.cH} sc${s.sc} sab${s.sab} shell${s.shell} navB${s.navB} gap${s.gap}`
        : "…";

export function ViewportDebug() {
    const [live, setLive] = useState<Snap | null>(null);
    const t0 = useRef<Snap | null>(null);

    useEffect(() => {
        const update = () => setLive(read());
        // Snapshot as close to first paint as possible.
        requestAnimationFrame(() => {
            if (!t0.current) t0.current = read();
            update();
        });
        const iv = setInterval(update, 400);
        window.addEventListener("resize", update);
        window.addEventListener("scroll", update, true);
        window.visualViewport?.addEventListener("resize", update);
        window.visualViewport?.addEventListener("scroll", update);
        return () => {
            clearInterval(iv);
            window.removeEventListener("resize", update);
            window.removeEventListener("scroll", update, true);
            window.visualViewport?.removeEventListener("resize", update);
            window.visualViewport?.removeEventListener("scroll", update);
        };
    }, []);

    return (
        <>
            <div id="vp-sab-probe" style={{ position: "fixed", paddingBottom: "env(safe-area-inset-bottom)", visibility: "hidden", pointerEvents: "none" }} />
            <div id="vp-dvh-probe" style={{ position: "fixed", top: 0, height: "100dvh", width: 0, visibility: "hidden", pointerEvents: "none" }} />
            <div
                style={{
                    position: "fixed",
                    top: 56,
                    left: 4,
                    right: 4,
                    zIndex: 100,
                    background: "rgba(0,0,0,0.88)",
                    color: "#4ade80",
                    font: "10px/1.5 ui-monospace, monospace",
                    padding: "6px 8px",
                    borderRadius: 6,
                    whiteSpace: "pre-wrap",
                    pointerEvents: "none",
                }}
            >
                {`MOUNT ${fmt(t0.current)}\nLIVE  ${fmt(live)}`}
            </div>
        </>
    );
}
