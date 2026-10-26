import { describe, expect, it } from "vitest";
import { activeTab, showTabBar, tabs } from "./navigation";

describe("UI1: навигация – панель вкладок", () => {
  it("UI1: has the tabs «Клиенты» and «Препараты» in that order", () => {
    expect(tabs.map((t) => t.key)).toEqual(["clients", "preparations"]);
  });

  it("UI1: highlights the tab of the current section", () => {
    expect(activeTab("/clients")).toBe("clients");
    expect(activeTab("/clients/00000000-0000-4000-8000-000000000001")).toBe("clients");
    expect(activeTab("/catalog")).toBe("preparations");
    expect(activeTab("/catalog/types/x")).toBe("preparations");
    expect(activeTab("/clientsx")).toBeNull();
    expect(activeTab("/login")).toBeNull();
  });

  it("UI1: shows the tab bar on main pages only, not in forms", () => {
    for (const path of ["/clients", "/clients/abc", "/catalog", "/catalog/types/abc", "/catalog/preparations/abc"]) {
      expect(showTabBar(path)).toBe(true);
    }
    for (const path of [
      "/clients/new",
      "/clients/abc/edit",
      "/clients/abc/visits/new",
      "/clients/abc/visits/v1/edit",
      "/catalog/types/new",
      "/catalog/types/abc/edit",
      "/catalog/preparations/new",
      "/catalog/preparations/abc/edit",
      "/login",
      "/mfa",
    ]) {
      expect(showTabBar(path)).toBe(false);
    }
  });
});
