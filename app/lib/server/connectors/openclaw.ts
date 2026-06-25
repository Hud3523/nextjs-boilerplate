import { env } from "../env";
import { serviceHealth, serviceTest, type HttpServiceConfig } from "./httpService";
import type { ServerConnector } from "./types";

// OpenClaw runtime (tool execution, browser automation, workflows) runs as an
// external service. Point OPENCLAW_BASE_URL at your running instance. Paths are
// overridable to match your OpenClaw deployment's routes.

function cfg(): HttpServiceConfig {
  return {
    baseUrl: env("OPENCLAW_BASE_URL"),
    apiKey: env("OPENCLAW_API_KEY"),
    healthPath: env("OPENCLAW_HEALTH_PATH") ?? "/health",
    testPath: env("OPENCLAW_STATUS_PATH") ?? "/status",
    testMethod: "GET",
  };
}

export const openclawConnector: ServerConnector = {
  id: "openclaw",
  configured() {
    return env("OPENCLAW_BASE_URL") !== undefined && env("OPENCLAW_API_KEY") !== undefined;
  },
  async health() {
    return serviceHealth(cfg());
  },
  async test() {
    return serviceTest(cfg());
  },
};
