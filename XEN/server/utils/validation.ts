import { z } from 'zod';

// Email validation schema
export const emailSchema = z.string().email('Invalid email format');

// SMTP configuration schema
export const smtpConfigSchema = z.object({
  smtpHost: z.string().min(1, 'SMTP host is required'),
  smtpPort: z.string().regex(/^\d+$/, 'Port must be a number').optional().default('587'),
  smtpUser: z.string().min(1, 'SMTP user is required'),
  smtpPass: z.string().min(1, 'SMTP password is required'),
  senderEmail: emailSchema.optional(),
  senderName: z.string().optional()
});

// File path validation schema
export const filePathSchema = z.string()
  .min(1, 'File path is required')
  .refine(path => !path.includes('..'), 'Path traversal not allowed')
  .refine(path => !path.startsWith('/'), 'Absolute paths not allowed')
  .refine(path => path.length <= 255, 'File path too long');

// Email recipients schema
export const recipientsSchema = z.union([
  z.array(emailSchema),
  z.string().transform((str, ctx) => {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) {
        return parsed.map(email => {
          const result = emailSchema.safeParse(email);
          if (!result.success) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Invalid email: ${email}`
            });
          }
          return email;
        });
      }
      // Handle newline-separated emails
      return str.split('\n')
        .map(email => email.trim())
        .filter(email => email.length > 0)
        .map(email => {
          const result = emailSchema.safeParse(email);
          if (!result.success) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Invalid email: ${email}`
            });
          }
          return email;
        });
    } catch {
      // If not JSON, treat as newline-separated
      return str.split('\n')
        .map(email => email.trim())
        .filter(email => email.length > 0)
        .map(email => {
          const result = emailSchema.safeParse(email);
          if (!result.success) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Invalid email: ${email}`
            });
          }
          return email;
        });
    }
  })
]);

// Email content schema
export const emailContentSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(255, 'Subject too long'),
  html: z.string().min(1, 'Email content is required'),
  attachmentHtml: z.string().optional()
});

// Email settings schema with proper validation
export const emailSettingsSchema = z.object({
  emailPerSecond: z.number().int().min(1).max(100).default(5),
  qrSize: z.number().int().min(50).max(1000).default(200),
  qrBorder: z.number().int().min(0).max(20).default(2),
  qrForegroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').default('#000000'),
  qrBackgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').default('#FFFFFF'),
  hiddenImageSize: z.number().int().min(10).max(200).default(50),
  qrcode: z.boolean().default(false),
  htmlImgBody: z.boolean().default(false),
  randomMetadata: z.boolean().default(false),
  minifyHtml: z.boolean().default(false),
  zipUse: z.boolean().default(false),
  retry: z.number().int().min(0).max(10).default(0),
  domainLogoSize: z.string().regex(/^\d+%?$/, 'Invalid size format').default('70%'),
  borderStyle: z.enum(['solid', 'dashed', 'dotted', 'double', 'none']).default('solid'),
  borderColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').default('#000000'),
  proxyUse: z.boolean().default(false)
});

// Content validation schema for file writing
export const fileContentSchema = z.string()
  .max(10 * 1024 * 1024, 'File content too large (max 10MB)')
  .refine(content => {
    // Check for potentially dangerous content
    const dangerousPatterns = [
      /<script[^>]*>[\s\S]*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /eval\s*\(/gi,
      /function\s*\(/gi
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(content)) {
        return false;
      }
    }
    return true;
  }, 'Content contains potentially dangerous scripts');

// Helper function to validate and transform request data
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: string[] } {
  try {
    const result = schema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    } else {
      const errors = result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      return { success: false, errors };
    }
  } catch (error) {
    return { success: false, errors: ['Validation failed: ' + String(error)] };
  }
}

// Sanitize HTML content
export function sanitizeHtml(html: string): string {
  // Basic HTML sanitization - remove dangerous tags and attributes
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<object[^>]*>[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[^>]*>/gi, '')
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '');
}

// Format validation errors for API responses
export function formatValidationError(errors: string[]): { error: string; details: string[] } {
  return {
    error: `Validation failed: ${errors.length} error(s)`,
    details: errors
  };
}