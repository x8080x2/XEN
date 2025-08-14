# CONFIG vs FRONTEND CONFLICT ANALYSIS

## ROOT CAUSE IDENTIFIED:

The config loading system works correctly, but **manual UI changes override the config**.

## EVIDENCE:

1. **Config File (Correct):**
   ```ini
   QRCODE=0
   HTML2IMG_BODY=0
   HIDDEN_IMAGE_FILE=
   RANDOM_METADATA=0
   ```

2. **Frontend Loading (Correct):**
   ```javascript
   qrcode: !!config.QRCODE,                    // 0 → false ✅
   htmlImgBody: !!config.HTML2IMG_BODY,        // 0 → false ✅
   hiddenImageFile: config.HIDDEN_IMAGE_FILE || '', // '' → '' ✅
   randomMetadata: !!config.RANDOM_METADATA,   // 0 → false ✅
   ```

3. **Email Send Logs (Problem):**
   ```
   qrcode: true                    // ❌ User enabled via UI
   htmlImgBody: true               // ❌ User enabled via UI  
   hiddenImageFile: 'microsoft-logo.svg' // ❌ User selected via UI
   randomMetadata: false           // ✅ Staying false
   ```

## THE ISSUE:

After config loads correctly with delivery-safe settings, the user manually:
1. Checked the QR Code checkbox
2. Enabled HTML Image Body  
3. Selected a hidden image file from the dropdown

This overrides the delivery-safe config settings and triggers spam filters.

## SOLUTIONS:

### Option 1: Lock Critical Settings
Add warnings and disable UI controls for spam-triggering features

### Option 2: Config Override Protection  
Prevent UI from enabling settings that config has disabled

### Option 3: Visual Warnings
Add red warning labels next to delivery-harmful settings

## RECOMMENDATION:

Implement Option 1 - Lock the delivery-critical settings and show warnings explaining why they're disabled for better inbox delivery.