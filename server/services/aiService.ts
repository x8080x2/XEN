import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

type AIProvider = 'openai' | 'gemini' | null;

class AIService {
  private openaiClient: OpenAI | null = null;
  private geminiClient: any = null;
  private provider: AIProvider = null;
  private apiKey: string = '';

  initialize(apiKey: string, provider?: 'openai' | 'gemini') {
    try {
      if (!provider) {
        if (apiKey.startsWith('sk-')) {
          provider = 'openai';
        } else if (apiKey.startsWith('AIzaSy')) {
          provider = 'gemini';
        } else {
          console.warn('[AIService] Unable to detect provider from API key');
          return false;
        }
      }

      this.apiKey = apiKey;
      this.provider = provider;

      if (provider === 'openai') {
        this.openaiClient = new OpenAI({ apiKey });
        console.log('[AIService] Initialized with OpenAI, key:', apiKey.substring(0, 10) + '...');
      } else if (provider === 'gemini') {
        const genAI = new GoogleGenerativeAI(apiKey);
        this.geminiClient = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
        console.log('[AIService] Initialized with Google Gemini, key:', apiKey.substring(0, 10) + '...');
      }

      return true;
    } catch (error) {
      console.error('[AIService] Initialization failed:', error);
      return false;
    }
  }

  async generateSubject(context: { recipient: string; originalSubject?: string; industry?: string }): Promise<string> {
    if (!this.provider) {
      throw new Error('AI Service not initialized. Please provide an API key.');
    }

    try {
      const prompt = `Generate a unique, engaging email subject line for ${context.recipient}. 
${context.originalSubject ? `Base it on this theme: "${context.originalSubject}"` : ''}
${context.industry ? `Industry context: ${context.industry}` : ''}
Make it personalized, professional, and attention-grabbing. Return only the subject line, nothing else.`;

      if (this.provider === 'gemini' && this.geminiClient) {
        const result = await this.geminiClient.generateContent(prompt);
        return result.response.text().trim() || context.originalSubject || 'Important Message';
      } else if (this.provider === 'openai' && this.openaiClient) {
        const completion = await this.openaiClient.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 50,
          temperature: 0.8
        });
        return completion.choices[0]?.message?.content?.trim() || context.originalSubject || 'Important Message';
      }

      return context.originalSubject || 'Important Message';
    } catch (error) {
      console.error('[AIService] Subject generation failed:', error);
      return context.originalSubject || 'Important Message';
    }
  }

  async generateSenderName(context: { originalName?: string; tone?: string }): Promise<string> {
    if (!this.provider) {
      throw new Error('AI Service not initialized. Please provide an API key.');
    }

    try {
      const prompt = `Generate a realistic professional sender name.
${context.originalName ? `Similar to: "${context.originalName}"` : ''}
${context.tone ? `Tone: ${context.tone}` : 'Professional and trustworthy'}
Return only the full name (First Last), nothing else.`;

      if (this.provider === 'gemini' && this.geminiClient) {
        const result = await this.geminiClient.generateContent(prompt);
        return result.response.text().trim() || context.originalName || 'Alex Morgan';
      } else if (this.provider === 'openai' && this.openaiClient) {
        const completion = await this.openaiClient.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 20,
          temperature: 0.9
        });
        return completion.choices[0]?.message?.content?.trim() || context.originalName || 'Alex Morgan';
      }

      return context.originalName || 'Alex Morgan';
    } catch (error) {
      console.error('[AIService] Sender name generation failed:', error);
      return context.originalName || 'Alex Morgan';
    }
  }

  async modifyHtmlFirstDiv(html: string, recipient: string): Promise<string> {
    if (!this.provider) {
      throw new Error('AI Service not initialized. Please provide an API key.');
    }

    try {
      const divMatch = html.match(/<div[^>]*>([\s\S]*?)<\/div>/i);
      if (!divMatch) {
        return html;
      }

      const originalDiv = divMatch[0];
      const divContent = divMatch[1];

      const prompt = `Rewrite this HTML div content to be unique while keeping the same meaning and structure. 
Make it personalized for ${recipient}.
Original: ${divContent}
Return only the new div content (without the <div> tags), nothing else.`;

      let newContent = divContent;

      if (this.provider === 'gemini' && this.geminiClient) {
        const result = await this.geminiClient.generateContent(prompt);
        newContent = result.response.text().trim() || divContent;
      } else if (this.provider === 'openai' && this.openaiClient) {
        const completion = await this.openaiClient.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 200,
          temperature: 0.7
        });
        newContent = completion.choices[0]?.message?.content?.trim() || divContent;
      }

      const newDiv = originalDiv.replace(divContent, newContent);
      return html.replace(originalDiv, newDiv);
    } catch (error) {
      console.error('[AIService] HTML modification failed:', error);
      return html;
    }
  }

  isInitialized(): boolean {
    return this.provider !== null;
  }

  getStatus(): { initialized: boolean; hasApiKey: boolean; provider: string | null } {
    return {
      initialized: this.provider !== null,
      hasApiKey: this.apiKey.length > 0,
      provider: this.provider
    };
  }
}

export const aiService = new AIService();
