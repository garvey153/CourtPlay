import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ContactModal, type ContactInfo } from "@/components/app/contact-modal";

function makeInfo(overrides: Partial<ContactInfo> = {}): ContactInfo {
    return {
        role: "claimer",
        viewerRole: "poster",
        firstName: "Jane",
        lastName: "Doe",
        phone: "203-555-0101",
        venmoHandle: "jane-doe-5",
        gameDate: "2026-04-10",
        gameTime: "09:00",
        location: "Longshore Club",
        cost: 25,
        ...overrides,
    };
}

describe("venmo deep link", () => {
    it("formatted correctly", () => {
        render(<ContactModal info={makeInfo()} onClose={() => {}} />);
        const link = screen.getByText("Request payment via Venmo").closest("a");
        expect(link).toBeTruthy();
        const href = link!.getAttribute("href")!;
        expect(href).toContain("venmo://paycharge");
        expect(href).toContain("recipients=jane-doe-5");
        expect(href).toContain("amount=25.00");
    });

    it("encodes special characters in location", () => {
        render(<ContactModal info={makeInfo({ location: "Town Hall & Courts" })} onClose={() => {}} />);
        const link = screen.getByText("Request payment via Venmo").closest("a");
        const href = link!.getAttribute("href")!;
        expect(href).toContain(encodeURIComponent("Town Hall & Courts"));
    });

    it("fallback URL formatted correctly", () => {
        render(<ContactModal info={makeInfo()} onClose={() => {}} />);
        const fallback = screen.getByText("Open Venmo on web instead").closest("a");
        expect(fallback!.getAttribute("href")).toBe("https://venmo.com/jane-doe-5");
    });

    it("uses live cost, not original_cost", () => {
        render(<ContactModal info={makeInfo({ cost: 20 })} onClose={() => {}} />);
        const link = screen.getByText("Request payment via Venmo").closest("a");
        const href = link!.getAttribute("href")!;
        expect(href).toContain("amount=20.00");
        expect(href).not.toContain("amount=40.00");
    });
});
