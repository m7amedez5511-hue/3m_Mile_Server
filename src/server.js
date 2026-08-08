import "dotenv/config";
import app from "./App/app.js";

import { registerGracefulShutdown } from "./lib/lifecycle.js";
import connectMongoDB from "./DB/connection/db_connection.js";

const PORT = process.env.PORT || 3000;

connectMongoDB()
  .then(() => {
    console.log("Connected to MongoDB successfully.");
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  });

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`docs available at http://localhost:${PORT}/api/v1/docs`);
});

registerGracefulShutdown("api", { server });