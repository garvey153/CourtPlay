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
        venmoHandle: "janedoe",
        gameDate: "2026-04-10",
        gameTime: "09:00",
        location: "Longshore Club",
        cost: 25,
        ...overrides,
    };
}

describe("post-approval screen", () => {
    it("poster sees claimer name and phone", () => {
        render(<ContactModal info={makeInfo()} onClose={() => {}} />);
        expect(screen.getByText("Jane Doe")).toBeInTheDocument();
        expect(screen.getByText("203-555-0101")).toBeInTheDocument();
    });

    it("poster sees Venmo deep link", () => {
        render(<ContactModal info={makeInfo()} onClose={() => {}} />);
        expect(screen.getByText("Request payment via Venmo")).toBeInTheDocument();
    });

    it("claimer sees poster name and phone", () => {
        render(<ContactModal info={makeInfo({ viewerRole: "claimer", role: "poster", firstName: "Mike", lastName: "Chen", phone: "203-555-0102" })} onClose={() => {}} />);
        expect(screen.getByText("Mike Chen")).toBeInTheDocument();
        expect(screen.getByText("203-555-0102")).toBeInTheDocument();
    });

    it("claimer sees pay reminder with Venmo handle and amount", () => {
        render(<ContactModal info={makeInfo({ viewerRole: "claimer", venmoHandle: "mikec", cost: 30 })} onClose={() => {}} />);
        const reminder = screen.getByText(/Remember to pay/);
        expect(reminder).toBeInTheDocument();
        expect(reminder.textContent).toContain("@mikec");
        expect(reminder.textContent).toContain("$30.00");
    });

    it("both parties see game date, time, and location", () => {
        render(<ContactModal info={makeInfo()} onClose={() => {}} />);
        expect(screen.getByText("Longshore Club")).toBeInTheDocument();
    });

    it("no Venmo link shown when venmoHandle is null", () => {
        render(<ContactModal info={makeInfo({ venmoHandle: null })} onClose={() => {}} />);
        expect(screen.queryByText("Request payment via Venmo")).not.toBeInTheDocument();
    });

    it("phone shows Not provided when null", () => {
        render(<ContactModal info={makeInfo({ phone: null })} onClose={() => {}} />);
        expect(screen.getByText("Not provided")).toBeInTheDocument();
    });
});
