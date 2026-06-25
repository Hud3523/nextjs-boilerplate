import { env } from "../env";
import { serviceHealth, serviceTest, type HttpServiceConfig } from "./httpService";
import type { ServerConnector } from "./types";

// Hermes agent framework (memory, skills, model routing) runs as an external
// service. Point HERMES_BASE_URL at your instance. The test call lists available
// models (OpenAI-compatible "/v1/models" by default); override if your Hermes
// deployment exposes a different route.

function cfg(): HttpServiceConfig {
  return {
    baseUrl: env("HERMES_BASE_URL"),
    apiKey: env("HERMES_API_KEY"),
    healthPath: env("HERMES_HEALTH_PATH") ?? "/health",
    testPath: env("HERMES_MODELS_PATH") ?? "/v1/models",
    testMethod: "GET",
  };
}

export const hermesConnector: ServerConnector = {
  id: "hermes",
  configured() {
    return env("HERMES_BASE_URL") !== undefined && env("HERMES_API_KEY") !== undefined;
  },
  async health() {
    return serviceHealth(cfg());
  },
  async test() {
    return serviceTest(cfg());
  },
};
