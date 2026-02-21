import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const { maintenanceModeMock, appModeMock, votingAdminMock } = vi.hoisted(() => ({
  maintenanceModeMock: vi.fn(async () => false),
  appModeMock: vi.fn(async (): Promise<"verification" | "waiting" | "voting"> => "waiting"),
  votingAdminMock: vi.fn(async () => false),
}))

vi.mock("./flags", () => ({
  maintenanceMode: maintenanceModeMock,
  appMode: appModeMock,
  votingAdmin: votingAdminMock,
}))

import { proxy } from "./proxy"

function makeRequest(pathname: string): NextRequest {
  return new NextRequest(`https://example.com${pathname}`)
}

describe("proxy governance admin route override", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    maintenanceModeMock.mockResolvedValue(false)
    appModeMock.mockResolvedValue("waiting")
    votingAdminMock.mockResolvedValue(false)
  })

  it("bypasses stage-gating for sentry tunnel route", async () => {
    const response = await proxy(makeRequest("/monitoring"))

    expect(response.headers.get("x-middleware-next")).toBe("1")
    expect(maintenanceModeMock).not.toHaveBeenCalled()
    expect(appModeMock).not.toHaveBeenCalled()
    expect(votingAdminMock).not.toHaveBeenCalled()
  })

  it("redirects to maintenance when maintenance mode is enabled", async () => {
    maintenanceModeMock.mockResolvedValue(true)

    const response = await proxy(makeRequest("/proposals/admin"))

    expect(response.headers.get("location")).toBe("https://example.com/maintenance")
    expect(votingAdminMock).not.toHaveBeenCalled()
  })

  it("redirects /proposals/admin to stage home when override is disabled", async () => {
    appModeMock.mockResolvedValue("waiting")
    votingAdminMock.mockResolvedValue(false)

    const response = await proxy(makeRequest("/proposals/admin"))

    expect(response.headers.get("location")).toBe("https://example.com/waiting")
    expect(votingAdminMock).toHaveBeenCalledTimes(1)
  })

  it("allows /proposals/admin outside voting mode when override is enabled", async () => {
    appModeMock.mockResolvedValue("verification")
    votingAdminMock.mockResolvedValue(true)

    const response = await proxy(makeRequest("/proposals/admin"))

    expect(response.headers.get("x-middleware-next")).toBe("1")
  })

  it("keeps non-admin proposals routes gated even when override is enabled", async () => {
    appModeMock.mockResolvedValue("waiting")
    votingAdminMock.mockResolvedValue(true)

    const response = await proxy(makeRequest("/proposals"))

    expect(response.headers.get("location")).toBe("https://example.com/waiting")
    expect(votingAdminMock).not.toHaveBeenCalled()
  })

  it("keeps existing voting-mode behavior unchanged", async () => {
    appModeMock.mockResolvedValue("voting")
    votingAdminMock.mockResolvedValue(false)

    const response = await proxy(makeRequest("/proposals/admin"))

    expect(response.headers.get("x-middleware-next")).toBe("1")
    expect(votingAdminMock).not.toHaveBeenCalled()
  })
})
