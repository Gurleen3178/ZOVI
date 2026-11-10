
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const aiRoutes = require("./routes/ai");
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use("/api/ai", aiRoutes);

// Test route
app.get("/", (req, res) => {
    res.json({
        message: "Welcome to ZOVI Backend!",
        status: "Server is running successfully."
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`ZOVI backend is running at http://localhost:${PORT}`);
});
