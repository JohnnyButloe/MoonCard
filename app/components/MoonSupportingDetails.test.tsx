// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildCanonicalMoonCardResponse,
  buildQueryResult,
} from "../test/fixtures/mooncard";

const mockUseMoonCard = vi.hoisted(() => vi.fn());

vi.mock("../hooks/useAstronomy", () => ({
  useMoonCard: mockUseMoonCard,
}));

import MoonSupportingDetails from "./MoonSupportingDetails";

describe("MoonSupportingDetails", () => {
  beforeEach(() => {
    mockUseMoonCard.mockReset();
  });

  it("renders paired sunrise and sunset twilight windows", () => {
    mockUseMoonCard.mockReturnValue(
      buildQueryResult({
        data: buildCanonicalMoonCardResponse(),
      }),
    );

    render(<MoonSupportingDetails lat={40.7} lon={-74} tz="UTC" />);

    expect(screen.getByText("Twilight Windows")).toBeInTheDocument();
    expect(
      screen.getByText("6:15 AM - 6:42 AM / 7:15 PM - 7:42 PM"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("5:42 AM - 6:15 AM / 7:42 PM - 8:12 PM"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("5:12 AM - 5:42 AM / 8:12 PM - 8:42 PM"),
    ).toBeInTheDocument();
  });
});
