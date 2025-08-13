import crypto from "crypto";

export class PlaceholderService {
  private readonly firstNames = [
    "James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda",
    "William", "Elizabeth", "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica",
    "Thomas", "Sarah", "Christopher", "Karen", "Charles", "Nancy", "Daniel", "Lisa"
  ];

  private readonly lastNames = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
    "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas",
    "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson", "White"
  ];

  private readonly companies = [
    "TechCorp", "InnovateLab", "FutureSoft", "DataDrive", "CloudWorks", "SmartSolutions",
    "NextGen Technologies", "Digital Dynamics", "Quantum Systems", "CyberCore", "ByteWorks",
    "InfoTech", "GlobalTech", "MetaSpace", "ProActive", "VirtualVision", "CodeCraft"
  ];

  private readonly domains = [
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "company.com", "business.org",
    "startup.io", "tech.net", "innovation.co", "digital.com", "cloud.org", "future.tech"
  ];

  private readonly jobTitles = [
    "Software Engineer", "Product Manager", "Data Scientist", "Marketing Director",
    "Sales Manager", "Designer", "Developer", "Analyst", "Consultant", "Specialist",
    "Coordinator", "Administrator", "Executive", "Director", "Manager", "Associate"
  ];

  async processPlaceholders(content: string, recipient: string, settings: any = {}): Promise<string> {
    let processed = content;

    // Extract email components
    const emailParts = this.parseEmail(recipient);
    
    // User-related placeholders
    processed = processed.replace(/{user}/g, recipient);
    processed = processed.replace(/{email}/g, recipient);
    processed = processed.replace(/{username}/g, emailParts.username);
    processed = processed.replace(/{userupper}/g, emailParts.username.toUpperCase());
    processed = processed.replace(/{userlower}/g, emailParts.username.toLowerCase());
    processed = processed.replace(/{domain}/g, emailParts.domain);
    processed = processed.replace(/{domainbase}/g, emailParts.domainBase);
    processed = processed.replace(/{initials}/g, this.getInitials(emailParts.username));
    processed = processed.replace(/{userid}/g, this.generateUserId(recipient));

    // Random placeholders
    processed = processed.replace(/{randfirst}/g, this.getRandomFirstName());
    processed = processed.replace(/{randlast}/g, this.getRandomLastName());
    processed = processed.replace(/{randname}/g, `${this.getRandomFirstName()} ${this.getRandomLastName()}`);
    processed = processed.replace(/{randcompany}/g, this.getRandomCompany());
    processed = processed.replace(/{randdomain}/g, this.getRandomDomain());
    processed = processed.replace(/{randtitle}/g, this.getRandomJobTitle());

    // Dynamic placeholders
    processed = processed.replace(/{date}/g, new Date().toLocaleDateString());
    processed = processed.replace(/{time}/g, new Date().toLocaleTimeString());
    processed = processed.replace(/{hash6}/g, this.generateHash(6));
    processed = processed.replace(/{randnum4}/g, this.generateRandomNumber(4));

    // Sender placeholders
    processed = processed.replace(/{senderemail}/g, settings.senderEmail || process.env.SMTP_USER || "");

    // QR Code processing
    if (settings.qrCode?.enabled) {
      processed = await this.processQRCode(processed, settings.qrCode, recipient);
    }

    // HTML minification
    if (settings.minifyHtml) {
      processed = this.minifyHtml(processed);
    }

    return processed;
  }

  private parseEmail(email: string) {
    const [username, domain] = email.split('@');
    const domainBase = domain.split('.')[0];
    
    return {
      username,
      domain,
      domainBase,
    };
  }

  private getInitials(name: string): string {
    return name.split(/[^a-zA-Z]/)
      .filter(part => part.length > 0)
      .map(part => part[0].toUpperCase())
      .join('');
  }

  private generateUserId(email: string): string {
    const hash = crypto.createHash('md5').update(email).digest('hex');
    return hash.substring(0, 8);
  }

  private getRandomFirstName(): string {
    return this.firstNames[Math.floor(Math.random() * this.firstNames.length)];
  }

  private getRandomLastName(): string {
    return this.lastNames[Math.floor(Math.random() * this.lastNames.length)];
  }

  private getRandomCompany(): string {
    return this.companies[Math.floor(Math.random() * this.companies.length)];
  }

  private getRandomDomain(): string {
    return this.domains[Math.floor(Math.random() * this.domains.length)];
  }

  private getRandomJobTitle(): string {
    return this.jobTitles[Math.floor(Math.random() * this.jobTitles.length)];
  }

  private generateHash(length: number): string {
    return crypto.randomBytes(Math.ceil(length / 2))
      .toString('hex')
      .substring(0, length);
  }

  private generateRandomNumber(digits: number): string {
    const min = Math.pow(10, digits - 1);
    const max = Math.pow(10, digits) - 1;
    return Math.floor(Math.random() * (max - min + 1) + min).toString();
  }

  private async processQRCode(content: string, qrSettings: any, recipient: string): Promise<string> {
    // QR code generation would be implemented here
    // For now, we'll just add a placeholder
    const qrLink = qrSettings.link || "https://example.com";
    const processedLink = await this.processPlaceholders(qrLink, recipient);
    
    const qrPlaceholder = `<img src="data:image/png;base64,..." alt="QR Code" width="${qrSettings.width || 200}" />`;
    
    // Replace {qrcode} placeholder if it exists
    return content.replace(/{qrcode}/g, qrPlaceholder);
  }

  private minifyHtml(html: string): string {
    return html
      .replace(/\s+/g, ' ')
      .replace(/>\s+</g, '><')
      .replace(/\s+>/g, '>')
      .replace(/<\s+/g, '<')
      .trim();
  }
}
