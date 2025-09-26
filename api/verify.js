// API serverless per verificare la storia usando Groq
import { Groq } from 'groq-sdk';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, model, temperature, response_format } = req.body;

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ error: 'GROQ_API_KEY environment variable not set' });
    }

    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });

    const response = await groq.chat.completions.create({
      model: model || "openai/gpt-oss-120b",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: response_format || { type: "json_object" },
      temperature: temperature || 0.2,
    });

    const content = response.choices[0]?.message?.content?.trim() || "";
    
    return res.status(200).json({ content });
  } catch (error) {
    console.error('Error calling Groq API:', error);
    return res.status(500).json({ error: 'Failed to verify content from API' });
  }
}