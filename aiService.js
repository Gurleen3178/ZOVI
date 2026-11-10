
const Groq = require("groq-sdk");

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

function findLastExplainedTopic(history) {
    const clarificationPattern =
        /which subject|which topic|what topic|could you clarify|please specify|could you let me know|repeat the topic/i;

    // Search backwards for the latest substantial assistant explanation.
    for (let i = history.length - 1; i >= 0; i--) {
        const assistantMessage = history[i];

        if (
            assistantMessage.role !== "assistant" ||
            typeof assistantMessage.content !== "string" ||
            assistantMessage.content.length < 200 ||
            clarificationPattern.test(assistantMessage.content)
        ) {
            continue;
        }

        // Find the user request that led to this assistant response.
        for (let j = i - 1; j >= 0; j--) {
            if (history[j].role === "user") {
                return {
                    userQuestion: history[j].content,
                    assistantAnswer: assistantMessage.content
                };
            }
        }
    }

    return null;
}

async function generateAIResponse({
    question,
    history = [],
    materialContext = "",
    subjectName = ""
}) {
    const hasMaterials =
        typeof materialContext === "string" &&
        materialContext.trim().length > 0;

    const topicContext = findLastExplainedTopic(history);

    const cleanMaterial = hasMaterials
    ? materialContext.trim().slice(0, 12000)
    : "";

    const teachingInstructions = `
You are ZOVI, a friendly, knowledgeable and reliable AI study tutor.

CURRENT SUBJECT: ${subjectName || "Not specified"}

IMPORTANT MATERIAL AVAILABILITY:
${hasMaterials
    ? `The student HAS ALREADY uploaded study material for this subject.
       You have received ${cleanMaterial.length} characters of extracted material.
       The material is available below in the student's current request.
       NEVER tell the student to upload files again.
       NEVER claim that no material is attached or available.
       You MUST read and use the supplied material when answering questions about this subject.`
    : `No extracted study material is currently available in this request.
       Do not pretend that you have read any uploaded material.`
}

MATERIAL INSTRUCTIONS:
- Treat the supplied study material as the primary source.
- When asked to summarize the material, summarize the available material immediately.
- When asked to summarize the entire subject, cover all major topics present in the supplied material.
- Organise long summaries into headings and bullet points.
- Do not stop after reading only the first page.
- Preserve important definitions, concepts, examples and terminology.
- Do not invent chapters or facts that are not supported by the material.
- If the available material is incomplete, clearly mention that.
- If a question is outside the supplied material, distinguish outside knowledge from the notes.
- Never ask the student to upload material that is already supplied in the current request.

CONVERSATION RULES:
- Treat the supplied history as one continuous conversation.
- Understand references such as "this topic", "that", "it", "same topic" and "continue".
- Never ask the student to repeat information already available.
- If the student requests MCQs, quizzes, flashcards, notes or examples, create them immediately.
- If the student requests exactly 5 MCQs, provide exactly 5.
- Every MCQ must have four options (A, B, C, D) and an answer key.
- Do not introduce yourself again during an ongoing conversation.
- Ask for clarification only when genuinely necessary.

TEACHING STYLE:
- Use simple, beginner-friendly language.
- Organise explanations with clear headings and bullet points.
- Explain difficult terms simply.
- Use relatable examples and analogies.
- Be patient, encouraging and clear.

FORMATTING:
- Do not use LaTeX, MathJax or dollar-sign mathematical notation.
- Write equations in ordinary readable text.
- Keep answers clean and readable.
`;

    const messages = [
        {
            role: "system",
            content: teachingInstructions
        }
    ];

 

    // Add only recent conversation history to control token usage.
const recentHistory = history
    .filter(item =>
        item &&
        ["user", "assistant"].includes(item.role) &&
        typeof item.content === "string" &&
        item.content.trim()
    )
    .slice(-4);

for (const item of recentHistory) {
    messages.push({
        role: item.role,
        content: item.content.slice(0, 1200)
    });
}
    // Attach the actual study material to the current user request.
    let currentUserMessage = question.trim();

    if (hasMaterials) {
        currentUserMessage += `

==================================================
STUDENT'S UPLOADED STUDY MATERIAL
SUBJECT: ${subjectName || "Not specified"}
==================================================

The following is text extracted from the student's uploaded files.

You MUST use this material to answer the student's request.

${cleanMaterial}

==================================================
END OF UPLOADED STUDY MATERIAL
==================================================

IMPORTANT:
The material above is already available.
Do not ask the student to upload it again.
If the student requested a summary, provide the summary now.
`;
    }

    messages.push({
        role: "user",
        content: currentUserMessage
    });

    try {
        console.log("\n========== ZOVI AI DEBUG ==========");
        console.log("CURRENT QUESTION:", question);
        console.log("SUBJECT:", subjectName);
        console.log("HISTORY COUNT:", history.length);
        console.log("MATERIAL AVAILABLE:", hasMaterials);
        console.log("MATERIAL CHARACTERS:", cleanMaterial.length);
        console.log("IDENTIFIED PREVIOUS TOPIC:",
            topicContext?.userQuestion || "None found"
        );
        console.log("FINAL MESSAGE COUNT:", messages.length);
        console.log("===================================\n");

        const completion = await groq.chat.completions.create({
            model: "openai/gpt-oss-120b",
            messages,
            temperature: 0.4,
            max_tokens: 4000
        });

        const answer =
            completion.choices[0]?.message?.content;

        if (!answer || !answer.trim()) {
            throw new Error("The AI returned an empty response.");
        }

        return answer;

    } catch (error) {
        console.error("Groq AI error:", error);
        throw new Error(
            "ZOVI could not generate an answer right now."
        );
    }
}
module.exports = { generateAIResponse };
