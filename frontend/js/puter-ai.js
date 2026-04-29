/**
 * Puter AI Module — SafeClick AI
 * Client-side Puter.js wrapper for chat and analysis fallback.
 * Exact port of src/lib/puter-ai.ts
 */

/**
 * Analyzes a message for security risks using Puter.js AI.
 * @param {string} message - The text to analyze
 * @returns {Promise<Object>} - Analysis result JSON
 */
async function analyzeWithPuter(message) {
    const systemPrompt =
        "You are a cybersecurity expert. " +
        "Analyze the given URL or text for security risks. " +
        "Return ONLY valid raw JSON (no markdown, no explanation) in this format:\n" +
        '{ "classification": "SAFE | SUSPICIOUS | DANGEROUS", "risk_score": number, "reasons": string[], "recommendation": "string" }';

    try {
        console.log("🚀 [PuterSDK] Attempting to analyze message with Puter.js");
        if (typeof window === "undefined" || !window.puter) {
            console.error("❌ [PuterSDK] Puter.js not loaded on window object");
            throw new Error("Puter.js not loaded");
        }

        console.log("🚀 [PuterSDK] Sending request to Puter.ai...");
        const response = await window.puter.ai.chat(
            [
                { role: "system", content: systemPrompt },
                { role: "user", content: message },
            ],
            { model: "gpt-4o-mini" }
        );
        console.log("✅ [PuterSDK] Response received:", response);

        const text = response?.message?.content || "";
        const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
        return JSON.parse(cleaned);
    } catch (error) {
        console.error("❌ [PuterSDK] Analysis Error:", error);
        throw error;
    }
}

/**
 * Sends a chat message history to Puter.js AI.
 * @param {Array<{role: string, content: string}>} messages
 * @returns {Promise<string>}
 */
async function chatWithPuter(messages) {
    const systemPrompt = `
    You are Aegis AI, a friendly and professional cybersecurity assistant.
    Rules:
    - Answer user questions directly and conversationally.
    - Explain concepts clearly (e.g., "What is Google?").
    - If the question is about cybersecurity, provide helpful insights.
    - Do NOT say things like "query is safe to process".
  `;

    try {
        console.log("🚀 [PuterSDK] Attempting to chat with Puter.js");
        if (typeof window === "undefined" || !window.puter) {
            console.error("❌ [PuterSDK] Puter.js not loaded");
            throw new Error("Puter.js not loaded");
        }

        const formattedMessages = [
            { role: "system", content: systemPrompt },
            ...messages.map((m) => ({
                role: m.role === "user" ? "user" : "assistant",
                content: m.content,
            })),
        ];

        console.log("🚀 [PuterSDK] Sending chat request...", formattedMessages);
        const response = await window.puter.ai.chat(formattedMessages, {
            model: "gpt-4o-mini",
        });
        console.log("✅ [PuterSDK] Chat response:", response);

        return response?.message?.content || "I'm not sure how to respond to that.";
    } catch (error) {
        console.error("❌ [PuterSDK] Chat Error:", error);
        throw error;
    }
}
