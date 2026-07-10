import { app } from "@/app";
import { appConfig } from "@/config/app.config";

const server = app.listen(appConfig.port, () => {
  console.log(
    `${appConfig.appName} listening on port ${appConfig.port} in ${appConfig.environment} mode`,
  );
});

function shutdown(signal: string) {
  console.log(`Received ${signal}. Shutting down gracefully...`);

  server.close((error) => {
    if (error) {
      console.error("Error while closing server", error);
      process.exit(1);
    }

    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
