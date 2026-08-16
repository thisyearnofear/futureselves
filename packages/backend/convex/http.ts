import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { webhook as revenueCatWebhook } from "./revenuecat";

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({
  path: "/revenuecat/webhook",
  method: "POST",
  handler: revenueCatWebhook,
});

export default http;
