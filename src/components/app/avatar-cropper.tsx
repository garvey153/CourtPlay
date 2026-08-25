import { useCallback, useEffect, useRef, useState } from "react";
import { XClose } from "@untitledui/icons";
import { PRIMARY_SM_FULL as PRIMARY_BTN, SECONDARY_SM_FULL as SECONDARY_BTN } from "@/components/base/buttons/button-styles";
import { Spinner } from "@/components/application/loading-indicator/spinner";
import {
    MAX_ZOOM,
    OUTPUT_SIZE,
    clampOffset,
    displayedSize,
    sourceRect,
    type Offset,
    type Size,
} from "@/lib/avatar-crop";

/** The square the photo is framed in, in CSS px. */
const VIEWPORT = 300;

/**
 * Place a photo inside the avatar circle: drag to move, pinch or slide to zoom.
 *
 * The photo is shown square with a circular hole punched over it, rather than
 * simply being round — you need to see what is about to be cut off to decide
 * where to put it. The export takes the SQUARE, because an avatar is displayed
 * round by whatever renders it and a round image would just bake the mask in.
 *
 * Zoom is offered twice on purpose. Pinch is what a phone reaches for, and the
 * slider is what works with one finger, a mouse, or a keyboard.
 */
export function AvatarCropper({
    file,
    busy = false,
    onCancel,
    onConfirm,
}: {
    file: File;
    busy?: boolean;
    onCancel: () => void;
    onConfirm: (blob: Blob) => void;
}) {
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });

    // Live pointers, for drag and pinch. A ref because these change per frame
    // and none of it belongs in a render.
    const pointers = useRef(new Map<number, { x: number; y: number }>());
    const gesture = useRef<{ offset: Offset; zoom: number; distance: number; centre: Offset } | null>(null);

    useEffect(() => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.decoding = "async";
        img.onload = () => setImage(img);
        img.onerror = () => setError("That image could not be read.");
        img.src = url;
        return () => URL.revokeObjectURL(url);
    }, [file]);

    const natural: Size | null = image ? { width: image.naturalWidth, height: image.naturalHeight } : null;

    const apply = useCallback(
        (nextZoom: number, nextOffset: Offset) => {
            if (!natural) return;
            const z = Math.min(MAX_ZOOM, Math.max(1, nextZoom));
            setZoom(z);
            setOffset(clampOffset(nextOffset, natural, VIEWPORT, z));
        },
        [natural],
    );

    const centreOf = () => {
        const list = [...pointers.current.values()];
        const sum = list.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });
        return { x: sum.x / list.length, y: sum.y / list.length };
    };
    const spread = () => {
        const [a, b] = [...pointers.current.values()];
        return Math.hypot(a.x - b.x, a.y - b.y);
    };

    const onPointerDown = (e: React.PointerEvent) => {
        (e.target as Element).setPointerCapture?.(e.pointerId);
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        gesture.current = {
            offset,
            zoom,
            centre: centreOf(),
            distance: pointers.current.size === 2 ? spread() : 0,
        };
    };

    const onPointerMove = (e: React.PointerEvent) => {
        if (!pointers.current.has(e.pointerId) || !gesture.current) return;
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const start = gesture.current;
        const centre = centreOf();

        // Two fingers zoom by how far apart they have moved; one finger pans.
        const nextZoom =
            pointers.current.size === 2 && start.distance > 0 ? (start.zoom * spread()) / start.distance : start.zoom;

        apply(nextZoom, {
            x: start.offset.x + (centre.x - start.centre.x),
            y: start.offset.y + (centre.y - start.centre.y),
        });
    };

    const endPointer = (e: React.PointerEvent) => {
        pointers.current.delete(e.pointerId);
        // Re-baseline, so lifting one finger of a pinch does not jump the photo.
        gesture.current = pointers.current.size
            ? { offset, zoom, centre: centreOf(), distance: pointers.current.size === 2 ? spread() : 0 }
            : null;
    };

    const handleConfirm = () => {
        if (!image || !natural) return;
        const { sx, sy, size } = sourceRect(natural, VIEWPORT, zoom, offset);
        const canvas = document.createElement("canvas");
        canvas.width = OUTPUT_SIZE;
        canvas.height = OUTPUT_SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) return setError("That image could not be read.");
        ctx.drawImage(image, sx, sy, size, size, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
        canvas.toBlob((blob) => (blob ? onConfirm(blob) : setError("That image could not be read.")), "image/jpeg", 0.9);
    };

    const shown = natural ? displayedSize(natural, VIEWPORT, zoom) : null;

    // The filled part of the track, as the design draws it.
    const progress = ((zoom - 1) / (MAX_ZOOM - 1)) * 100;

    return (
        <div
            className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="avatar-cropper-title"
        >
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-[8px]"
                onClick={busy ? undefined : onCancel}
                aria-hidden="true"
            />

            <div className="relative flex w-full max-w-md flex-col rounded-t-2xl bg-secondary shadow-xl sm:rounded-2xl">
                <div className="flex flex-col gap-0.5 px-5 pt-[18px]">
                    <h2 id="avatar-cropper-title" className="pr-9 text-md font-semibold text-primary">
                        Position your photo
                    </h2>
                    <p className="text-xs text-secondary">Drag to move, pinch or use the slider to zoom.</p>
                </div>

                <button
                    type="button"
                    onClick={onCancel}
                    disabled={busy}
                    aria-label="Close"
                    className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-lg p-2 text-tertiary transition duration-100 ease-linear hover:text-secondary"
                >
                    <XClose className="size-5" strokeWidth={1} />
                </button>

                {error ? (
                    <p className="px-5 pt-[27px] text-sm text-error-primary">{error}</p>
                ) : (
                    <>
                        <div className="flex justify-center pt-[27px]">
                            <div
                                className="relative touch-none overflow-hidden rounded-lg bg-primary select-none"
                                style={{ width: VIEWPORT, height: VIEWPORT }}
                                onPointerDown={onPointerDown}
                                onPointerMove={onPointerMove}
                                onPointerUp={endPointer}
                                onPointerCancel={endPointer}
                            >
                                {image && shown ? (
                                    <img
                                        src={image.src}
                                        alt=""
                                        draggable={false}
                                        className="pointer-events-none absolute max-w-none"
                                        style={{
                                            width: shown.width,
                                            height: shown.height,
                                            left: VIEWPORT / 2 + offset.x - shown.width / 2,
                                            top: VIEWPORT / 2 + offset.y - shown.height / 2,
                                        }}
                                    />
                                ) : (
                                    <div className="flex size-full items-center justify-center">
                                        <Spinner size="md" />
                                    </div>
                                )}

                                {/* The circle as a hole rather than a border: what falls
                                    outside it is what gets cut, and you should be able to
                                    see it while deciding where to put the photo. */}
                                {/* The dim belongs OUTSIDE the circle. An outward
                                    box-shadow spread from a transparent circle does
                                    that; the parent's overflow-hidden trims it. An
                                    inset shadow clipped TO the circle — which is what
                                    this was — darkens the wrong half, hiding the part
                                    you are trying to place. */}
                                <div
                                    aria-hidden="true"
                                    className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-white/40 ring-inset"
                                    style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)" }}
                                />
                            </div>
                        </div>

                        {/* Track and handle drawn to the design (689:4805): an 8px
                            rounded track that fills brand up to the handle, and a 24px
                            white handle ringed in brand. The fill is a gradient on the
                            input itself, which is the only way to colour one side of a
                            native range and keep the input's own keyboard behaviour. */}
                        <div className="flex w-full items-center px-5 pt-4">
                            <input
                                type="range"
                                aria-label="Zoom"
                                min={1}
                                max={MAX_ZOOM}
                                step={0.01}
                                value={zoom}
                                disabled={!image}
                                onChange={(e) => apply(Number(e.target.value), offset)}
                                style={{
                                    // The design's own values, not the app tokens of the
                                    // same names: bg/brand is #1AB363 (brand-500) where
                                    // --color-bg-brand-solid is brand-600, and the track
                                    // is drawn light where this theme's bg-quaternary is
                                    // a dark grey. Matching the drawing, as with the
                                    // claim error's red.
                                    background: `linear-gradient(to right, #1ab363 ${progress}%, #e5e5e5 ${progress}%)`,
                                }}
                                className="h-2 w-full cursor-pointer appearance-none rounded-full disabled:cursor-not-allowed disabled:opacity-50 [&::-moz-range-thumb]:size-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-brand-500 [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:size-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-brand-500 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md"
                            />
                        </div>
                    </>
                )}

                <div className="flex w-full flex-col gap-3 px-5 pt-4 pb-[calc(2rem_+_var(--safe-bottom))]">
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={!image || busy || !!error}
                        className={`${PRIMARY_BTN} relative`}
                    >
                        <span className={busy ? "invisible" : undefined}>Use photo</span>
                        {busy && (
                            <Spinner
                                size="sm"
                                tone="on-brand"
                                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                            />
                        )}
                    </button>
                    <button type="button" onClick={onCancel} disabled={busy} className={SECONDARY_BTN}>
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
