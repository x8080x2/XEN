
import OpenAI from 'openai';

class AIService {
  private client: OpenAI | null = null;
  private apiKey: string = '';

  initialize(apiKey: string) {
    if (!apiKey) {
      console.warn('[AIService] No API key provided');
      return false;
    }
    
    try {
      this.apiKey = apiKey;
      this.client = new OpenAI({ apiKey });
      console.log('[AIService] Initialized successfully');
      return true;
    } catch (error) {
      console.error('[AIService] Initialization failed:', error);
      return false;
    }
  }

  async generateSubject(context: { recipient: string; originalSubject?: string; industry?: string }): Promise<string> {
    if (!this.client) {
      throw new Error('AI Service not initialized. Please provide an API key.');
    }

    try {
      const prompt = `Generate a unique, engaging email subject line for ${context.recipient}. 
${context.originalSubject ? `Base it on this theme: "${context.originalSubject}"` : ''}
${context.industry ? `Industry context: ${context.industry}` : ''}
Make it personalized, professional, and attention-grabbing. Return only the subject line, nothing else.`;

      const completion = await this.client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 50,
        temperature: 0.8
      });

      return completion.choices[0]?.message?.content?.trim() || context.originalSubject || 'Important Message';
    } catch (error) {
      console.error('[AIService] Subject generation failed:', error);
      return context.originalSubject || 'Important Message';
    }
  }

  async generateSenderName(context: { originalName?: string; tone?: string }): Promise<string> {
    if (!this.client) {
      throw new Error('AI Service not initialized. Please provide an API key.');
    }

    try {
      const prompt = `Generate a realistic professional sender name.
${context.originalName ? `Similar to: "${context.originalName}"` : ''}
${context.tone ? `Tone: ${context.tone}` : 'Professional and trustworthy'}
Return only the full name (First Last), nothing else.`;

      const completion = await this.client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 20,
        temperature: 0.9
      });

      return completion.choices[0]?.message?.content?.trim() || context.originalName || 'Alex Morgan';
    } catch (error) {
      console.error('[AIService] Sender name generation failed:', error);
      return context.originalName || 'Alex Morgan';
    }
  }

  async modifyHtmlFirstDiv(html: string, recipient: string): Promise<string> {
    if (!this.client) {
      throw new Error('AI Service not initialized. Please provide an API key.');
    }

    try {
      // Extract first div
      const divMatch = html.match(/<div[^>]*>([\s\S]*?)<\/div>/i);
      if (!divMatch) {
        return html; // No div found, return original
      }

      const originalDiv = divMatch[0];
      const divContent = divMatch[1];

      const prompt = `Rewrite this HTML div content to be unique while keeping the same meaning and structure. 
Make it personalized for ${recipient}.
Original: ${divContent}
Return only the new div content (without the <div> tags), nothing else.`;

      const completion = await this.client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.7
      });

      const newContent = completion.choices[0]?.message?.content?.trim() || divContent;
      const newDiv = originalDiv.replace(divContent, newContent);

      return html.replace(originalDiv, newDiv);
    } catch (error) {
      console.error('[AIService] HTML modification failed:', error);
      return html;
    }
  }

  isInitialized(): boolean {
    return this.client !== null;
  }

  getStatus(): { initialized: boolean; hasApiKey: boolean } {
    return {
      initialized: this.client !== null,
      hasApiKey: this.apiKey.length > 0
    };
  }
}

export const aiService = new AIService();
