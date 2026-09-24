import { describe, expect, it } from "vitest";
import { SAMPLE_DATA, sampleBody } from "../commands/app";

const EVENTS = [
  "order.created",
  "order.paid",
  "order.status_changed",
  "product.created",
  "product.updated",
  "product.deleted",
  "customer.created",
  "customer.updated",
  "refund.created",
  "refund.completed",
  "shipment.created",
  "shipment.status_changed",
  "inventory.level_changed",
  "checkout.abandoned",
  "app.uninstalled",
  "store.redact",
];

describe("numu app webhook trigger samples", () => {
  it("has a sample for every event NUMU delivers", () => {
    expect(Object.keys(SAMPLE_DATA).sort()).toEqual([...EVENTS].sort());
  });

  it("puts store_id first in data, like NUMU", () => {
    for (const event of EVENTS) {
      const body = JSON.parse(sampleBody(event, "2026-09-24T00:00:00Z"));
      expect(body.event).toBe(event);
      expect(Object.keys(body.data)[0]).toBe("store_id");
    }
  });
});
