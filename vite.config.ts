import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import { Groq } from 'groq-sdk';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api/generate': {
            target: 'http://localhost:3000',
            changeOrigin: true,
            configure: (proxy, _options) => {
              proxy.on('error', (err, _req, _res) => {
                console.log('proxy error', err);
              });
              proxy.on('proxyReq', (proxyReq, req, _res) => {
                proxyReq.on('error', (err) => {
                  console.log('proxyReq error', err);
                });
              });
            },
            bypass: async (req, res) => {
              if (req.url === '/api/generate' && req.method === 'POST') {
                try {
                  const chunks = [];
                  for await (const chunk of req) {
                    chunks.push(chunk);
                  }
                  const body = JSON.parse(Buffer.concat(chunks).toString());
                  const { prompt, model, temperature, top_p, response_format } = body;

                  const groq = new Groq({
                    apiKey: env.GROQ_API_KEY,
                    dangerouslyAllowBrowser: true
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
                    temperature: temperature || 1,
                    top_p: top_p || 0.95
                  });

                  const content = response.choices[0]?.message?.content?.trim() || "";
                  
                  // Verifica che il contenuto sia un JSON valido prima di restituirlo
                  try {
                    const parsedContent = JSON.parse(content);
                    
                    // Verifica che la struttura dei dati sia valida
                    if (!parsedContent || typeof parsedContent !== 'object') {
                      throw new Error('La risposta non è un oggetto JSON valido');
                    }
                    
                    // Verifica che i campi obbligatori siano presenti
                    if (!parsedContent.title || !parsedContent.commonDocument || !parsedContent.characters || !parsedContent.solution) {
                      throw new Error('La struttura dei dati generata non è valida. Mancano campi obbligatori.');
                    }
                    
                    // Verifica che commonDocument abbia i campi richiesti
                    if (!parsedContent.commonDocument.introduction || !parsedContent.commonDocument.crimeSceneMapDescription || !parsedContent.commonDocument.characterOverviews) {
                      throw new Error('La struttura di commonDocument non è valida. Mancano campi obbligatori.');
                    }
                    
                    // Verifica che solution abbia i campi richiesti
                    if (!parsedContent.solution.culprits || !parsedContent.solution.motive || !parsedContent.solution.how || !parsedContent.solution.backstory) {
                      throw new Error('La struttura di solution non è valida. Mancano campi obbligatori.');
                    }
                    
                    // Verifica che ogni personaggio abbia tutti i campi richiesti
                    if (!Array.isArray(parsedContent.characters) || parsedContent.characters.length === 0) {
                      throw new Error('La lista dei personaggi non è valida o è vuota.');
                    }
                    
                    for (const character of parsedContent.characters) {
                      if (!character.name || character.isCulprit === undefined || !character.initialDescription || 
                          !character.relationships || !character.round1Info || !character.round2Info || 
                          !character.round3Info || !character.secretsAndMotives || 
                          !Array.isArray(character.opinionsOnOthers)) {
                        throw new Error(`Il personaggio "${character.name || 'senza nome'}" non ha tutti i campi richiesti.`);
                      }
                    }
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ content }));
                  } catch (jsonError) {
                    console.error('Invalid JSON response from Groq API:', jsonError);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: jsonError.message || 'Invalid JSON response from API' }));
                  }
                  return true;
                } catch (error) {
                  console.error('Error calling Groq API:', error);
                  res.writeHead(500, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: 'Failed to generate content from API' }));
                  return true;
                }
              }
              return false;
            }
          },
          '/api/verify': {
            target: 'http://localhost:3000',
            changeOrigin: true,
            configure: (proxy, _options) => {
              proxy.on('error', (err, _req, _res) => {
                console.log('proxy error', err);
              });
              proxy.on('proxyReq', (proxyReq, req, _res) => {
                proxyReq.on('error', (err) => {
                  console.log('proxyReq error', err);
                });
              });
            },
            bypass: async (req, res) => {
              if (req.url === '/api/verify' && req.method === 'POST') {
                try {
                  const chunks = [];
                  for await (const chunk of req) {
                    chunks.push(chunk);
                  }
                  const body = JSON.parse(Buffer.concat(chunks).toString());
                  const { prompt, model, temperature, response_format } = body;

                  const groq = new Groq({
                    apiKey: env.GROQ_API_KEY,
                    dangerouslyAllowBrowser: true
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
                  
                  // Verifica che il contenuto sia un JSON valido prima di restituirlo
                  try {
                    const parsedContent = JSON.parse(content);
                    
                    // Verifica che la struttura dei dati sia valida
                    if (!parsedContent || typeof parsedContent !== 'object') {
                      throw new Error('La risposta di verifica non è un oggetto JSON valido');
                    }
                    
                    // Verifica che i campi obbligatori siano presenti
                    if (!parsedContent.title || !parsedContent.commonDocument || !parsedContent.characters || !parsedContent.solution) {
                      throw new Error('La struttura dei dati verificata non è valida. Mancano campi obbligatori.');
                    }
                    
                    // Verifica che commonDocument abbia i campi richiesti
                    if (!parsedContent.commonDocument.introduction || !parsedContent.commonDocument.crimeSceneMapDescription || !parsedContent.commonDocument.characterOverviews) {
                      throw new Error('La struttura di commonDocument verificata non è valida. Mancano campi obbligatori.');
                    }
                    
                    // Verifica che solution abbia i campi richiesti
                    if (!parsedContent.solution.culprits || !parsedContent.solution.motive || !parsedContent.solution.how || !parsedContent.solution.backstory) {
                      throw new Error('La struttura di solution verificata non è valida. Mancano campi obbligatori.');
                    }
                    
                    // Verifica che ogni personaggio abbia tutti i campi richiesti
                    if (!Array.isArray(parsedContent.characters) || parsedContent.characters.length === 0) {
                      throw new Error('La lista dei personaggi verificata non è valida o è vuota.');
                    }
                    
                    for (const character of parsedContent.characters) {
                      if (!character.name || character.isCulprit === undefined || !character.initialDescription || 
                          !character.relationships || !character.round1Info || !character.round2Info || 
                          !character.round3Info || !character.secretsAndMotives || 
                          !Array.isArray(character.opinionsOnOthers)) {
                        throw new Error(`Il personaggio verificato "${character.name || 'senza nome'}" non ha tutti i campi richiesti.`);
                      }
                    }
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ content }));
                  } catch (jsonError) {
                    console.error('Invalid JSON verification response from Groq API:', jsonError);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: jsonError.message || 'Invalid JSON verification response from API' }));
                  }
                  return true;
                } catch (error) {
                  console.error('Error calling Groq API:', error);
                  res.writeHead(500, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: 'Failed to verify content from API' }));
                  return true;
                }
              }
              return false;
            }
          }
        }
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GROQ_API_KEY': JSON.stringify(env.GROQ_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
