/**
 * Unit tests for the getTimePressure logic from sub-card.tsx.
 * The function is not exported, so we recreate the same logic here.
 */

const NOW = new Date("2026-04-07T10:00:00").getTime();

function getTimePressure(
    gameDate: string | null,
    gameTime: string | null,
): { label: string; color: "success" | "warning" | "error" } | null {
    if (!gameDate || !gameTime) return null;
    const gameDateTime = new Date(`${gameDate}T${gameTime}`);
    const hoursUntil = (gameDateTime.getTime() - Date.now()) / 3600000;
    if (hoursUntil <= 0 || hoursUntil >= 24) return null;
    const label = `Game in ${Math.floor(hoursUntil)}h`;
    if (hoursUntil > 12) return { label, color: "success" };
    if (hoursUntil > 4) return { label, color: "warning" };
    return { label, color: "error" };
}

/**
 * Helper to create a game date/time string pair N hours from NOW.
 * Uses local time formatting to match how the function parses dates
 * (without a Z suffix, Date treats it as local time).
 */
function gameAt(hoursFromNow: number): { date: string; time: string } {
    const d = new Date(NOW + hoursFromNow * 3600000);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return {
        date: `${year}-${month}-${day}`,
        time: `${hours}:${minutes}`,
    };
}

describe("getTimePressure", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(NOW));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("shows green label when game is 14 hours away", () => {
        const { date, time } = gameAt(14);
        expect(getTimePressure(date, time)).toEqual({
            label: "Game in 14h",
            color: "success",
        });
    });

    it("shows green label when game is 13 hours away", () => {
        const { date, time } = gameAt(13);
        expect(getTimePressure(date, time)).toEqual({
            label: "Game in 13h",
            color: "success",
        });
    });

    it("transition to amber at exactly 12 hours", () => {
        const { date, time } = gameAt(12);
        expect(getTimePressure(date, time)).toEqual({
            label: "Game in 12h",
            color: "warning",
        });
    });

    it("shows amber label when game is 8 hours away", () => {
        const { date, time } = gameAt(8);
        expect(getTimePressure(date, time)).toEqual({
            label: "Game in 8h",
            color: "warning",
        });
    });

    it("shows amber label when game is 5 hours away", () => {
        const { date, time } = gameAt(5);
        expect(getTimePressure(date, time)).toEqual({
            label: "Game in 5h",
            color: "warning",
        });
    });

    it("transition to red at exactly 4 hours", () => {
        const { date, time } = gameAt(4);
        expect(getTimePressure(date, time)).toEqual({
            label: "Game in 4h",
            color: "error",
        });
    });

    it("shows red label when game is 2 hours away", () => {
        const { date, time } = gameAt(2);
        expect(getTimePressure(date, time)).toEqual({
            label: "Game in 2h",
            color: "error",
        });
    });

    it("shows red label when game is 1 hour away", () => {
        const { date, time } = gameAt(1);
        expect(getTimePressure(date, time)).toEqual({
            label: "Game in 1h",
            color: "error",
        });
    });

    it("no label when game is exactly 24 hours away", () => {
        const { date, time } = gameAt(24);
        expect(getTimePressure(date, time)).toBeNull();
    });

    it("no label when game is 25 hours away", () => {
        const { date, time } = gameAt(25);
        expect(getTimePressure(date, time)).toBeNull();
    });

    it("no label when game has started (0 hours)", () => {
        const { date, time } = gameAt(0);
        expect(getTimePressure(date, time)).toBeNull();
    });

    it("no label on regular_game posts (null inputs)", () => {
        expect(getTimePressure(null, null)).toBeNull();
        expect(getTimePressure("2026-04-07", null)).toBeNull();
        expect(getTimePressure(null, "14:00")).toBeNull();
    });

    it("hours rounded down to whole number", () => {
        const { date, time } = gameAt(3.7);
        expect(getTimePressure(date, time)).toEqual({
            label: "Game in 3h",
            color: "error",
        });
    });

    it("label uses both game_date AND game_time", () => {
        // Build a date/time exactly 6 hours from now using the helper
        const { date, time } = gameAt(6);
        const result = getTimePressure(date, time);
        expect(result).toEqual({
            label: "Game in 6h",
            color: "warning",
        });
    });
});
