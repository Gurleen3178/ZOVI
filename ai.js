const express = require("express");
const router = express.Router();
const { generateAIResponse } = require("../services/aiService");

router.post("/ask", async (req, res) => {
    try {
        const {
            question,
            history = [],
            materialContext = "",
            subjectName = ""
        } = req.body || {};

        if (typeof question !== "string" || !question.trim()) {
            return res.status(400).json({ error: "Please enter a question." });
        }

        const safeHistory = Array.isArray(history)
            ? history
                .filter(item =>
                    item &&
                    ["user", "assistant"].includes(item.role) &&
                    typeof item.content === "string" &&
                    item.content.trim()
                )
                .slice(-12)
                .map(item => ({
                    role: item.role,
                    content: item.content.slice(0, 8000)
                }))
            : [];

        const safeMaterialContext =
            typeof materialContext === "string"
                ? materialContext.slice(0, 30000)
                : "";

        const safeSubjectName =
            typeof subjectName === "string" ? subjectName.slice(0, 150) : "";

        const answer = await generateAIResponse({
            question: question.trim().slice(0, 8000),
            history: safeHistory,
            materialContext: safeMaterialContext,
            subjectName: safeSubjectName
        });

        res.json({ answer });
    } catch (error) {
        console.error("AI route error:", error);
        res.status(500).json({
            error: "ZOVI could not answer your question right now."
        });
    }
});

module.exports = router;
