// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import SportsLoading from "./loading"

describe("SportsLoading", () => {
  it("says the sports are loading, once, beside a skeleton hidden from a screen reader", () => {
    render(<SportsLoading />)
    expect(screen.getAllByRole("status")).toHaveLength(1)
    expect(screen.getByRole("status")).toHaveTextContent("Loading sports…")
  })
})
