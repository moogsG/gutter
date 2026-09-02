import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OptionalSourceNotice } from "@/components/journal/OptionalSourceNotice";

describe("OptionalSourceNotice", () => {
  it("shows configuration recovery without presenting missing data as empty", () => {
    render(
      <OptionalSourceNotice
        source={{
          state: "not-configured",
          message: "Set OPENCLAW_WORKSPACE_PATH to load this source.",
          recovery: "configure",
        }}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Not configured");
    expect(screen.getByText(/OPENCLAW_WORKSPACE_PATH/)).toBeInTheDocument();
  });

  it("offers retry recovery for an unavailable source", () => {
    const onRetry = vi.fn();
    render(
      <OptionalSourceNotice
        source={{
          state: "unavailable",
          message: "Calendar could not be reached.",
          recovery: "retry",
        }}
        onRetry={onRetry}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("does not show a degradation notice for a true empty source", () => {
    const { container } = render(
      <OptionalSourceNotice
        source={{
          state: "empty",
          message: "No meetings in this range.",
          recovery: null,
        }}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
