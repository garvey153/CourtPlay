import { useCallback, useEffect, useRef, useState } from "react";
import { Copy01, MessageCircle02 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";

interface ShareModalProps {
    url: string;
    text: string;
    onClose: () => void;
}

export function ShareModal({ url, text, onClose }: ShareModalProps) {
    const overlayRef = useRef<HTMLDivElement>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (e.target === overlayRef.current) onClose();
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [onClose]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [onClose]);

    const handleCopy = useCallback(async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [url]);

    const fullText = `${text} ${url}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(fullText)}`;
    const smsUrl = `sms:?&body=${encodeURIComponent(fullText)}`;

    return (
        <div
            ref={overlayRef}
            className="fixed inset-0 z-50 flex items-end justify-center bg-overlay sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-modal-title"
        >
            <div className="w-full max-w-sm rounded-t-2xl bg-primary p-6 shadow-xl sm:rounded-2xl">
                <h2 id="share-modal-title" className="text-lg font-semibold text-primary">
                    Share this spot
                </h2>

                <div className="mt-4 flex flex-col gap-2">
                    {/* Copy link */}
                    <button
                        onClick={handleCopy}
                        className="flex items-center gap-3 rounded-lg border border-secondary px-4 py-3 text-left text-sm font-medium text-primary hover:bg-primary_hover"
                    >
                        <Copy01 className="size-5 shrink-0 text-fg-tertiary" />
                        {copied ? "Copied!" : "Copy link"}
                    </button>

                    {/* iMessage */}
                    <a
                        href={smsUrl}
                        className="flex items-center gap-3 rounded-lg border border-secondary px-4 py-3 text-sm font-medium text-primary hover:bg-primary_hover"
                    >
                        <MessageCircle02 className="size-5 shrink-0 text-fg-tertiary" />
                        Share via iMessage
                    </a>

                    {/* WhatsApp */}
                    <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 rounded-lg border border-secondary px-4 py-3 text-sm font-medium text-primary hover:bg-primary_hover"
                    >
                        <svg className="size-5 shrink-0 text-fg-tertiary" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                        Share via WhatsApp
                    </a>
                </div>

                <Button
                    color="secondary"
                    size="md"
                    className="mt-4 w-full"
                    onClick={onClose}
                >
                    Cancel
                </Button>
            </div>
        </div>
    );
}
