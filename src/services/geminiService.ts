import { GoogleGenAI, Type } from "@google/genai";
import { Package } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function getPersonalizedRecommendations(
  userPreferences: string[],
  availablePackages: Package[]
): Promise<string[]> {
  if (!process.env.GEMINI_API_KEY) {
    console.warn("GEMINI_API_KEY is not set.");
    return availablePackages.slice(0, 3).map(p => p.id);
  }

  const prompt = `
    Given the following travel user preferences: ${userPreferences.join(", ")}.
    And the available travel packages:
    ${JSON.stringify(availablePackages.map(p => ({ id: p.id, name: p.name, category: p.category, tags: p.tags })))}
    
    Recommend the top 3 most relevant package IDs for this user.
    Return only the array of IDs in JSON format.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    const text = response.text;
    if (text) {
      return JSON.parse(text);
    }
  } catch (error) {
    console.error("Gemini recommendation error:", error);
  }
  
  return availablePackages.slice(0, 3).map(p => p.id);
}
