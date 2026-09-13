import "dotenv/config";
import "./DB/models/index.js";
import app from "./App/app.js";

import { registerGracefulShutdown } from "./lib/lifecycle.js";
import connectMongoDB from "./DB/connection/db_connection.js";

const PORT = Number.parseInt(process.env.PORT || "5000", 10);

const startServer = () => {
  const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`docs available at http://localhost:${PORT}/api/v1/docs`);
  });

  registerGracefulShutdown("api", { server });
};

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
  process.exit(1);
});

connectMongoDB()
  .then(() => {
    console.log("Connected to MongoDB successfully.");
    startServer();
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  });
