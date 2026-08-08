import express from "express";
import path from "path";
import cors from "cors";
import morgan from "morgan";
import { helmetMiddleware } from "../utils/security.js";
import routes from "../routes/index.js";
import { errorHandler, notFoundHandler } from "../middleware/errorHandler.js";
import dotenv  from "dotenv";
dotenv.config()
const app = express();

const environment = process.env.NODE_ENV || "development";
const isDevelopment = ["dev", "development", "uat"].includes(environment);

// Required when running behind nginx reverse proxy (X-Forwarded-* headers).
app.set("trust proxy", 1);

// ## Middlewares
if (isDevelopment) {
  app.use(morgan("dev"));
}

// Security & Basic Config
app.use(helmetMiddleware);

const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean)
  : undefined;

app.use(
  cors(
    corsOrigins?.length
      ? { origin: corsOrigins, credentials: true }
      : undefined,
  ),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use("/public", express.static(path.join(process.cwd(), "public")));

// Basic Health Check
app.get("/", (req, res) => res.send("3mMile API Server is running..."));

// API Routes (Includes /docs, /health, /v1/client)
app.use("/api", routes);

// Handle 404 - Not Found
app.use(notFoundHandler);

// Global Error Handler
app.use(errorHandler);

export default app;
