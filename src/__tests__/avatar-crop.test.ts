import { describe, expect, it } from "vitest";
import { OUTPUT_SIZE, clampOffset, coverScale, displayedSize, sourceRect } from "@/lib/avatar-crop";

const V = 260;
const landscape = { width: 4000, height: 3000 };
const portrait = { width: 3000, height: 4000 };

describe("avatar crop geometry", () => {
    it("covers the square from the SHORT side, whichever that is", () => {
        // Scaling by the long side would leave the circle showing through.
        expect(coverScale(landscape, V)).toBeCloseTo(V / 3000);
        expect(coverScale(portrait, V)).toBeCloseTo(V / 3000);
    });

    it("never lets an edge inside the frame", () => {
        const shown = displayedSize(landscape, V, 1);
        const slack = (shown.width - V) / 2;
        expect(clampOffset({ x: 9999, y: 0 }, landscape, V, 1).x).toBeCloseTo(slack);
        expect(clampOffset({ x: -9999, y: 0 }, landscape, V, 1).x).toBeCloseTo(-slack);
        // The short side exactly covers at zoom 1, so it cannot move at all.
        expect(clampOffset({ x: 0, y: 50 }, landscape, V, 1).y).toBe(0);
    });

    /**
     * The export has to read the same region the viewport was showing. If these
     * two ever disagree the crop silently lands somewhere else, which is the one
     * failure a person would only notice after saving.
     */
    it("reads back the region the viewport was showing", () => {
        const centred = sourceRect(landscape, V, 1, { x: 0, y: 0 });
        // Centred at cover scale: full height, and a centred slice of the width.
        expect(centred.size).toBeCloseTo(3000);
        expect(centred.sy).toBeCloseTo(0);
        expect(centred.sx).toBeCloseTo((4000 - 3000) / 2);
    });

    it("moves the source the opposite way to the drag", () => {
        // Dragging the photo right shows more of its left-hand side.
        const dragged = sourceRect(landscape, V, 1, { x: 26, y: 0 });
        const centred = sourceRect(landscape, V, 1, { x: 0, y: 0 });
        expect(dragged.sx).toBeLessThan(centred.sx);
        expect(centred.sx - dragged.sx).toBeCloseTo(26 / coverScale(landscape, V));
    });

    it("takes a smaller region as it zooms in", () => {
        expect(sourceRect(portrait, V, 2, { x: 0, y: 0 }).size).toBeCloseTo(
            sourceRect(portrait, V, 1, { x: 0, y: 0 }).size / 2,
        );
    });

    it("exports a square larger than it is ever shown", () => {
        expect(OUTPUT_SIZE).toBeGreaterThan(V);
    });
});
