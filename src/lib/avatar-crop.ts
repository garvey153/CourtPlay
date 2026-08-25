/**
 * The geometry behind the avatar cropper, kept away from the component so it
 * can be reasoned about and tested without a canvas or a pointer.
 *
 * One coordinate system throughout: the VIEWPORT is a square of `size` px with
 * its origin at the top left, and the image is centred in it and then nudged by
 * an offset. Everything else is derived from that.
 */

/** The exported avatar's edge, in px. Larger than it is ever displayed at. */
export const OUTPUT_SIZE = 512;

/** How far in the cropper can zoom, as a multiple of "just covers the square". */
export const MAX_ZOOM = 4;

export interface Size {
    width: number;
    height: number;
}

export interface Offset {
    x: number;
    y: number;
}

/**
 * The scale at which the image exactly covers the viewport — the floor, since
 * anything smaller would leave the circle showing through to the background.
 */
export const coverScale = (image: Size, viewport: number): number =>
    Math.max(viewport / image.width, viewport / image.height);

/** The image's displayed size at a given zoom. */
export const displayedSize = (image: Size, viewport: number, zoom: number): Size => {
    const scale = coverScale(image, viewport) * zoom;
    return { width: image.width * scale, height: image.height * scale };
};

/**
 * Pull an offset back to where the image still covers the viewport.
 *
 * Panning is otherwise free to drag an edge into view, which reads as a bug
 * rather than as a limit — you would be able to centre on nothing.
 */
export const clampOffset = (offset: Offset, image: Size, viewport: number, zoom: number): Offset => {
    const { width, height } = displayedSize(image, viewport, zoom);
    const limitX = Math.max(0, (width - viewport) / 2);
    const limitY = Math.max(0, (height - viewport) / 2);
    return {
        x: Math.min(limitX, Math.max(-limitX, offset.x)),
        y: Math.min(limitY, Math.max(-limitY, offset.y)),
    };
};

/**
 * The region of the ORIGINAL image that the viewport is showing, in image px.
 *
 * This is what the export draws from, so it is the one piece that has to agree
 * exactly with what was on screen — the same offset and zoom, run backwards.
 */
export const sourceRect = (image: Size, viewport: number, zoom: number, offset: Offset) => {
    const scale = coverScale(image, viewport) * zoom;
    const { width, height } = displayedSize(image, viewport, zoom);

    // Top-left of the displayed image, in viewport coordinates.
    const originX = viewport / 2 + offset.x - width / 2;
    const originY = viewport / 2 + offset.y - height / 2;

    return {
        sx: -originX / scale,
        sy: -originY / scale,
        size: viewport / scale,
    };
};
