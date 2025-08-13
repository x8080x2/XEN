import { configService } from './configService';

export interface PlaceholderValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  validPlaceholders: string[];
  invalidPlaceholders: string[];
}

export interface PlaceholderInfo {
  name: string;
  description: string;
  example: string;
  category: 'user' | 'random' | 'dynamic' | 'advanced';
  pattern?: RegExp;
}

export class PlaceholderValidator {
  private static placeholders: PlaceholderInfo[] = [
    // User-specific placeholders
    { name: 'user', description: 'Full recipient email address', example: 'john@example.com', category: 'user' },
    { name: 'email', description: 'Recipient email (same as user)', example: 'john@example.com', category: 'user' },
    { name: 'username', description: 'Email username part', example: 'john', category: 'user' },
    { name: 'userupper', description: 'Username in uppercase', example: 'JOHN', category: 'user' },
    { name: 'userlower', description: 'Username in lowercase', example: 'john', category: 'user' },
    { name: 'domain', description: 'Email domain', example: 'example.com', category: 'user' },
    { name: 'domainbase', description: 'Domain without extension', example: 'example', category: 'user' },
    { name: 'initials', description: 'User initials', example: 'JS', category: 'user' },
    { name: 'userid', description: 'Generated user ID', example: '123456', category: 'user' },

    // Random placeholders
    { name: 'randfirst', description: 'Random first name', example: 'Daniel', category: 'random' },
    { name: 'randlast', description: 'Random last name', example: 'Smith', category: 'random' },
    { name: 'randname', description: 'Random full name', example: 'Daniel Smith', category: 'random' },
    { name: 'randcompany', description: 'Random company name', example: 'Vertex Dynamics', category: 'random' },
    { name: 'randdomain', description: 'Random domain name', example: 'neoatlas.io', category: 'random' },
    { name: 'randtitle', description: 'Random job title', example: 'Account Manager', category: 'random' },

    // Dynamic placeholders
    { name: 'date', description: 'Current date', example: '2025-08-13', category: 'dynamic' },
    { name: 'time', description: 'Current time', example: '14:30:25', category: 'dynamic' },
    { name: 'senderemail', description: 'Sender email address', example: 'sender@company.com', category: 'dynamic' },

    // Advanced placeholders with patterns
    { name: 'hash6', description: '6-character hash', example: 'a1b2c3', category: 'advanced', pattern: /\{hash(\d+)\}/g },
    { name: 'randnum4', description: '4-digit random number', example: '1234', category: 'advanced', pattern: /\{randnum(\d+)\}/g },
    { name: 'randchar5', description: '5-character random string', example: 'AbC12', category: 'advanced', pattern: /\{randchar(\d+)\}/g },
  ];

  public static validateContent(content: string, recipient?: string): PlaceholderValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];
    const validPlaceholders: string[] = [];
    const invalidPlaceholders: string[] = [];

    // Find all placeholders in content
    const placeholderMatches = content.match(/\{[^}]+\}/g) || [];
    
    for (const match of placeholderMatches) {
      const placeholder = match.slice(1, -1); // Remove { and }
      const isValid = this.isValidPlaceholder(placeholder);
      
      if (isValid) {
        validPlaceholders.push(match);
      } else {
        invalidPlaceholders.push(match);
        errors.push(`Invalid placeholder: ${match}`);
        
        // Suggest similar placeholders
        const suggestions_for_placeholder = this.getSuggestions(placeholder);
        if (suggestions_for_placeholder.length > 0) {
          suggestions.push(`Did you mean: ${suggestions_for_placeholder.join(', ')} instead of ${match}?`);
        }
      }
    }

    // Check for common mistakes
    if (content.includes('{username') && !content.includes('{username}')) {
      warnings.push('Found incomplete placeholder: {username - missing closing brace');
    }
    
    if (content.includes('user}') && !content.includes('{user}')) {
      warnings.push('Found incomplete placeholder: user} - missing opening brace');
    }

    // Check for recipient-specific validations
    if (recipient) {
      if (content.includes('{user}') || content.includes('{email}')) {
        // Good - using recipient placeholders
      } else {
        warnings.push('Consider adding recipient-specific placeholders like {user} or {username}');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      validPlaceholders,
      invalidPlaceholders
    };
  }

  public static isValidPlaceholder(placeholder: string): boolean {
    // Check exact matches
    if (this.placeholders.some(p => p.name === placeholder)) {
      return true;
    }

    // Check pattern matches (for dynamic placeholders like hash6, randnum4, etc.)
    for (const placeholderInfo of this.placeholders) {
      if (placeholderInfo.pattern && placeholderInfo.pattern.test(`{${placeholder}}`)) {
        return true;
      }
    }

    return false;
  }

  public static getSuggestions(placeholder: string): string[] {
    const suggestions: string[] = [];
    const lowerPlaceholder = placeholder.toLowerCase();

    for (const info of this.placeholders) {
      if (info.name.toLowerCase().includes(lowerPlaceholder) || 
          lowerPlaceholder.includes(info.name.toLowerCase())) {
        suggestions.push(`{${info.name}}`);
      }
    }

    return suggestions.slice(0, 3); // Return top 3 suggestions
  }

  public static getAllPlaceholders(): PlaceholderInfo[] {
    return this.placeholders;
  }

  public static getPlaceholdersByCategory(category: string): PlaceholderInfo[] {
    return this.placeholders.filter(p => p.category === category);
  }

  public static highlightSyntax(content: string): string {
    // Replace placeholders with highlighted versions for display
    return content.replace(/\{([^}]+)\}/g, (match, placeholder) => {
      const isValid = this.isValidPlaceholder(placeholder);
      const cssClass = isValid ? 'valid-placeholder' : 'invalid-placeholder';
      return `<span class="${cssClass}" title="${isValid ? 'Valid placeholder' : 'Invalid placeholder'}">${match}</span>`;
    });
  }

  public static generatePreview(content: string, recipient: string): string {
    // Generate a preview with sample data
    const sampleData = {
      user: recipient || 'john@example.com',
      email: recipient || 'john@example.com',
      username: (recipient || 'john@example.com').split('@')[0],
      userupper: (recipient || 'john@example.com').split('@')[0].toUpperCase(),
      userlower: (recipient || 'john@example.com').split('@')[0].toLowerCase(),
      domain: (recipient || 'john@example.com').split('@')[1] || 'example.com',
      domainbase: ((recipient || 'john@example.com').split('@')[1] || 'example.com').split('.')[0],
      initials: 'JS',
      userid: '123456',
      randfirst: 'Daniel',
      randlast: 'Smith',
      randname: 'Daniel Smith',
      randcompany: 'Vertex Dynamics',
      randdomain: 'neoatlas.io',
      randtitle: 'Account Manager',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().split(' ')[0],
      senderemail: 'sender@company.com',
      hash6: 'a1b2c3',
      randnum4: '1234',
      randchar5: 'AbC12'
    };

    let preview = content;
    
    // Replace standard placeholders
    for (const [key, value] of Object.entries(sampleData)) {
      preview = preview.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }

    // Replace pattern-based placeholders
    preview = preview.replace(/\{hash(\d+)\}/g, (match, len) => {
      const length = parseInt(len) || 6;
      return Array(length).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
    });

    preview = preview.replace(/\{randnum(\d+)\}/g, (match, len) => {
      const length = parseInt(len) || 4;
      return Array(length).fill(0).map(() => Math.floor(Math.random() * 10)).join('');
    });

    preview = preview.replace(/\{randchar(\d+)\}/g, (match, len) => {
      const length = parseInt(len) || 5;
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      return Array(length).fill(0).map(() => chars[Math.floor(Math.random() * chars.length)]).join('');
    });

    return preview;
  }
}