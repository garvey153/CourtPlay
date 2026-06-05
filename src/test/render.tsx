import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router";

export function renderWithProviders(ui: ReactElement) {
    return render(ui, {
        wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
    });
}

export { screen, waitFor, within, userEvent };
