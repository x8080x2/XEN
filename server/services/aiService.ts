import { GoogleGenerativeAI } from '@google/generative-ai';

class AIService {
  private geminiClient: any = null;
  private apiKey: string = '';

  initialize(apiKey: string) {
    try {
      if (!apiKey || !apiKey.startsWith('AIzaSy')) {
        console.warn('[AIService] Invalid Google AI API key provided');
        return false;
      }

      this.apiKey = apiKey;
      const genAI = new GoogleGenerativeAI(apiKey);
      this.geminiClient = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
      console.log('[AIService] Initialized with Google Gemini, key:', apiKey.substring(0, 10) + '...');
      
      return true;
    } catch (error) {
      console.error('[AIService] Initialization failed:', error);
      return false;
    }
  }

  async generateSubject(context: { recipient: string; originalSubject?: string; industry?: string }): Promise<string> {
    if (!this.geminiClient) {
      throw new Error('AI Service not initialized. Please provide a Google AI API key.');
    }

    try {
      const prompt = `Generate a unique, engaging email subject line for ${context.recipient}. 
${context.originalSubject ? `Base it on this theme: "${context.originalSubject}"` : ''}
${context.industry ? `Industry context: ${context.industry}` : ''}
Make it personalized, professional, and attention-grabbing. Return only the subject line, nothing else.`;

      const result = await this.geminiClient.generateContent(prompt);
      return result.response.text().trim() || context.originalSubject || 'Important Message';
    } catch (error) {
      console.error('[AIService] Subject generation failed:', error);
      return context.originalSubject || 'Important Message';
    }
  }

  async generateSenderName(context: { originalName?: string; tone?: string }): Promise<string> {
    if (!this.geminiClient) {
      throw new Error('AI Service not initialized. Please provide a Google AI API key.');
    }

    try {
      const prompt = `Generate a realistic professional sender name.
${context.originalName ? `Similar to: "${context.originalName}"` : ''}
${context.tone ? `Tone: ${context.tone}` : 'Professional and trustworthy'}
Return only the full name (First Last), nothing else.`;

      const result = await this.geminiClient.generateContent(prompt);
      return result.response.text().trim() || context.originalName || 'Alex Morgan';
    } catch (error) {
      console.error('[AIService] Sender name generation failed:', error);
      return context.originalName || 'Alex Morgan';
    }
  }

  async modifyHtmlFirstDiv(html: string, recipient: string): Promise<string> {
    if (!this.geminiClient) {
      throw new Error('AI Service not initialized. Please provide a Google AI API key.');
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

      const result = await this.geminiClient.generateContent(prompt);
      const newContent = result.response.text().trim() || divContent;
      const newDiv = originalDiv.replace(divContent, newContent);
      
      return html.replace(originalDiv, newDiv);
    } catch (error) {
      console.error('[AIService] HTML modification failed:', error);
      return html;
    }
  }

  isInitialized(): boolean {
    return this.geminiClient !== null;
  }

  getStatus(): { initialized: boolean; hasApiKey: boolean; provider: string } {
    return {
      initialized: this.geminiClient !== null,
      hasApiKey: this.apiKey.length > 0,
      provider: 'gemini'
    };
  }
}

export const aiService = new AIService();
