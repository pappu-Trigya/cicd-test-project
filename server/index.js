const express = require("express");
const app = express();
require("dotenv").config();
const cookieParser = require("cookie-parser");
const cors = require("cors");

const port = process.env.X_ZOHO_CATALYST_LISTEN_PORT || process.env.PORT || 8000;

app.use(cookieParser());
app.use(express.json());

// In production, Nginx proxies requests on the same origin.
// In local dev, allow localhost ports.
if (process.env.NODE_ENV !== "production") {
    app.use(cors({
        origin: ["http://localhost:5173", "http://localhost:3001"],
        credentials: true,
    }));
} else {
    // Same-origin via Nginx proxy in production
    app.use(cors({ credentials: true }));
}

app.use(express.urlencoded({ extended: true }));

// Health Check Endpoint
app.get("/health", (req, res) => {
    res.status(200).json({ status: "UP", timestamp: new Date() });
});

// Example API Routes
// const userRouter = require("./router/users/router");
// app.use("/api/v1/users", userRouter);

app.listen(port, "0.0.0.0", () => {
    console.log(`Server listening dynamically on port ${port}`);
});

module.exports = app;