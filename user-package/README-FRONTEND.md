
# Email Sender Frontend

This is the frontend-only version of the email sender application.

## Setup

1. Run the setup script:
   ```bash
   node setup-frontend.js
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure your backend URL in `client/src/lib/queryClient.ts`:
   ```typescript
   // Replace with your actual backend URL
   const API_BASE_URL = "https://your-backend-url.com";
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## Configuration

Make sure to update the `VITE_API_URL` in your environment or the `API_BASE_URL` in `queryClient.ts` to point to your deployed backend server.

## Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.
