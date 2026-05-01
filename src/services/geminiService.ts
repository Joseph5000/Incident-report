/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";
import { IncidentReport } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateIncidentSummary(report: IncidentReport): Promise<string> {
  try {
    const prompt = `
      As a tactical incident analyst, provide a concise, high-level executive summary of the following incident report. 
      Focus on the critical facts: Type, Location, Time, and a brief synthesis of the description.
      Use professional, objective, and tactical language.
      Keep it under 3 sentences.

      INCIDENT DATA:
      Type: ${report.type}
      Time: ${new Date(report.createdAt).toLocaleString()}
      Location: ${report.location?.address || 'Unknown'}
      Description: ${report.description}
      Involved Parties: ${report.signatures.map(s => s.name).join(', ') || 'None listed'}
      Audio Statements: ${report.audioNotes?.length || 0} clips recorded.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: "You are a professional tactical incident analyst in a law enforcement agency. Your task is to summarize field reports into clear, actionable executive briefings.",
      }
    });

    return response.text || "Summary unavailable.";
  } catch (error) {
    console.error("Gemini summary error:", error);
    return "Failed to generate AI summary. Please review tactical logs manually.";
  }
}
