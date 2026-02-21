import { GoogleGenAI } from "@google/genai";

let aiClient = null;

const getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return null;
  }

  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }

  return aiClient;
};

const extractJsonString = (raw) => {
  const fenced = raw.match(/```json\s*([\s\S]*?)\s*```/i);
  const objectLike = raw.match(/\{[\s\S]*\}/);
  return fenced?.[1] || objectLike?.[0] || raw.trim();
};

const readResponseText = async (response) => {
  if (!response) return "";

  if (typeof response.text === "function") {
    const value = await response.text();
    return typeof value === "string" ? value : JSON.stringify(value);
  }

  if (typeof response.text === "string") {
    return response.text;
  }

  const parts = response?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    return parts.map((part) => part?.text || "").join("\n");
  }

  return JSON.stringify(response);
};

const analyzeTicket = async (ticket) => {
  try {
    const ai = getAiClient();

    if (!ai) {
      console.warn("GEMINI_API_KEY is missing. Skipping AI analysis.");
      return null;
    }

    const prompt = `
You are an expert AI assistant that processes technical support tickets.
Respond ONLY in strict JSON format with keys:
summary, priority, helpfulNotes, relatedSkills.

Priority must be one of: low, medium, high.

Analyze this support ticket:

Title: ${ticket.title}
Description: ${ticket.description}
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const raw = await readResponseText(response);
    const jsonString = extractJsonString(raw);
    const parsed = JSON.parse(jsonString);

    return {
      summary: parsed.summary || "",
      priority: ["low", "medium", "high"].includes(String(parsed.priority).toLowerCase())
        ? String(parsed.priority).toLowerCase()
        : "medium",
      helpfulNotes: parsed.helpfulNotes || "",
      relatedSkills: Array.isArray(parsed.relatedSkills)
        ? parsed.relatedSkills.map((s) => String(s).trim()).filter(Boolean)
        : [],
    };
  } catch (error) {
    console.error("AI parsing error:", error.message);
    return null;
  }
};

export default analyzeTicket;
