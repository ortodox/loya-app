import { describe, expect, it } from "vitest";
import { getConsumption } from "./consumption";

const botox = { id: "t1", code: "BT-01", name: { ru: "Ботулинотерапия" } };
const repo = { listVisits: async () => [{ clientId: "a", visitDate: "2026-10-05", remindOn: null, items: [{ key: "p", name: "Botox", type: botox, quantity: "30" }] }] };

describe("RS1: расход – месяц", () => {
  it("RS1: this month by default, a past month when asked, never a future or broken one", async () => {
    expect((await getConsumption(repo, undefined, "2026-11-06")).month).toBe("2026-11");
    expect((await getConsumption(repo, "2026-10", "2026-11-06")).used[0].rows[0].amount).toBe(30);
    expect((await getConsumption(repo, "2027-01", "2026-11-06")).month).toBe("2026-11");
    expect((await getConsumption(repo, "nope", "2026-11-06")).month).toBe("2026-11");
  });
});
