/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { IncidentReport } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function analyzeIncidentMedia(images: string[]) {
  if (images.length === 0) return null;

  try {
    const parts = images.slice(0, 3).map(img => ({
      inlineData: {
        mimeType: "image/jpeg",
        data: img.split(',')[1]
      }
    }));

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          ...parts,
          { text: "Analyze these evidence photos from a traffic incident. Identify visible damage, vehicle models if possible, and assess severity (Low/Medium/High). Return as JSON." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            damageType: { type: Type.STRING, description: "Description of damage" },
            severity: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
            identifiedItems: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Vehicles or objects identified"
            }
          }
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return null;
  }
}

export async function generateNarrative(rawDescription: string, officerNotes?: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Draft a professional, formal police narrative based on these raw notes: "${rawDescription}". Officer notes: "${officerNotes || 'None'}". Ensure it follows official reporting standards (clear, objective, chronological).`,
      config: {
        systemInstruction: "You are an expert police report writer. Convert raw field notes into polished, objective chronological narratives."
      }
    });

    return response.text;
  } catch (error) {
    console.error("Narrative Generation Error:", error);
    return null;
  }
}

export async function suggestIncidentType(description: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Based on this description, categorize the incident into one of these types: "Vehicle Accident", "Hit and Run", "Vehicle Impound", "Traffic Obstruction", "Public Disturbance", "Other / Assist". Return ONLY the exact type name. Description: "${description}"`
    });
    return response.text?.trim();
  } catch (error) {
    console.error("Type Suggestion Error:", error);
    return null;
  }
}

export async function generateIncidentSummary(report: IncidentReport) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Summarize this incident report into a single, professional one-sentence summary for a quick-view table. 
      Type: ${report.type}
      Location: ${report.location.address}
      Description: "${report.description}"`,
    });
    return response.text?.trim();
  } catch (error) {
    console.error("Summary Generation Error:", error);
    return report.description.slice(0, 50) + "...";
  }
}
