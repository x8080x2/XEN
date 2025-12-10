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

      // Skip if already initialized with same key
      if (this.geminiClient && this.apiKey === apiKey) {
        console.log('[AIService] Already initialized with this key');
        return true;
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

  async generateSubject(context: { recipient: string; originalSubject?: string; industry?: string; htmlContent?: string }): Promise<string> {
    if (!this.geminiClient) {
      throw new Error('AI Service not initialized. Please provide a Google AI API key.');
    }

    try {
      const prompt = `Analyze this email HTML content and generate a matching subject line for ${context.recipient}:

EMAIL CONTENT:
${context.htmlContent || 'No content provided'}

${context.originalSubject ? `Original subject: "${context.originalSubject}"` : ''}
${context.industry ? `Industry: ${context.industry}` : ''}

IMPORTANT RULES:
- Subject MUST match the content and tone of the HTML
- Do NOT use placeholder text like [Your Name], [City], [Region], etc.
- Use only concrete, specific values that align with the email content
- Keep any actual values from the original subject
- Make it personalized, professional, and attention-grabbing
- Return ONLY the subject line, nothing else`;

      const result = await this.geminiClient.generateContent(prompt);
      const generated = result.response.text().trim();
      if (!generated) {
        throw new Error('AI failed to generate subject');
      }
      return generated;
    } catch (error) {
      console.error('[AIService] Subject generation failed:', error);
      throw new Error('AI subject generation failed. Please check your AI configuration.');
    }
  }

  async generateSenderName(context: { originalName?: string; tone?: string; htmlContent?: string }): Promise<string> {
    if (!this.geminiClient) {
      throw new Error('AI Service not initialized. Please provide a Google AI API key.');
    }

    try {
      const prompt = `Analyze this email HTML content and generate a sender name that matches the content:

EMAIL CONTENT:
${context.htmlContent || 'No content provided'}

${context.originalName ? `Original name: "${context.originalName}"` : ''}
${context.tone ? `Tone: ${context.tone}` : 'Professional and trustworthy'}

IMPORTANT RULES:
- Sender name MUST match the email content and industry/context
- Return ONLY an actual full name (First Last)
- Do NOT use placeholder text like [Name], [Your Name], etc.
- Use a real-sounding name that fits the email's purpose
- No brackets, no placeholders, just a clean name`;

      const result = await this.geminiClient.generateContent(prompt);
      const generated = result.response.text().trim();
      if (!generated) {
        throw new Error('AI failed to generate sender name');
      }
      return generated;
    } catch (error) {
      console.error('[AIService] Sender name generation failed:', error);
      throw new Error('AI sender name generation failed. Please check your AI configuration.');
    }
  }

  async generateContent(prompt: string): Promise<string> {
    if (!this.geminiClient) {
      throw new Error('AI Service not initialized. Please provide a Google AI API key.');
    }

    try {
      const result = await this.geminiClient.generateContent(prompt);
      return result.response.text().trim();
    } catch (error) {
      console.error('[AIService] Content generation failed:', error);
      throw error;
    }
  }

  async generatePlaceholder(type: 'firstname' | 'lastname' | 'company' | 'domain' | 'title', context?: string): Promise<string> {
    if (!this.geminiClient) {
      throw new Error('AI Service not initialized. Please provide a Google AI API key.');
    }

    try {
      const prompts = {
        firstname: 'Generate a realistic first name. Return ONLY the name, nothing else.',
        lastname: 'Generate a realistic last name. Return ONLY the name, nothing else.',
        company: 'Generate a realistic company name. Return ONLY the company name, nothing else.',
        domain: 'Generate a realistic domain name (e.g., example.com). Return ONLY the domain, nothing else.',
        title: 'Generate a realistic professional job title. Return ONLY the title, nothing else.'
      };

      const prompt = context 
        ? `${prompts[type]} Context: ${context}`
        : prompts[type];

      const result = await this.geminiClient.generateContent(prompt);
      const generated = result.response.text().trim();
      if (!generated) {
        throw new Error(`AI failed to generate ${type}`);
      }
      return generated;
    } catch (error) {
      console.error(`[AIService] Placeholder ${type} generation failed:`, error);
      throw new Error(`AI placeholder generation failed for ${type}`);
    }
  }

  deinitialize() {
    this.geminiClient = null;
    this.apiKey = '';
    console.log('[AIService] AI service deinitialized');
    return true;
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
