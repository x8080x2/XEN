import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function QROverlayTest() {
  const [qrUrl, setQrUrl] = useState("https://example.com");
  const [qrSize, setQrSize] = useState("200");
  const [borderColor, setBorderColor] = useState("#000000");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>QR Code Overlay Test</CardTitle>
          <CardDescription>
            Test and preview QR code generation with different settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <Label htmlFor="qr-url">QR Code URL</Label>
                <Input
                  id="qr-url"
                  value={qrUrl}
                  onChange={(e) => setQrUrl(e.target.value)}
                  placeholder="Enter URL for QR code"
                  data-testid="input-qr-url"
                />
              </div>
              
              <div>
                <Label htmlFor="qr-size">QR Code Size</Label>
                <Input
                  id="qr-size"
                  value={qrSize}
                  onChange={(e) => setQrSize(e.target.value)}
                  placeholder="200"
                  data-testid="input-qr-size"
                />
              </div>
              
              <div>
                <Label htmlFor="border-color">Border Color</Label>
                <Input
                  id="border-color"
                  type="color"
                  value={borderColor}
                  onChange={(e) => setBorderColor(e.target.value)}
                  data-testid="input-border-color"
                />
              </div>
              
              <div>
                <Label htmlFor="bg-color">Background Color</Label>
                <Input
                  id="bg-color"
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  data-testid="input-bg-color"
                />
              </div>
              
              <Button 
                className="w-full" 
                data-testid="button-generate-qr"
              >
                Generate QR Code
              </Button>
            </div>
            
            <div className="flex items-center justify-center bg-muted/50 rounded-lg p-6">
              <div className="text-center text-muted-foreground">
                QR Code Preview Area
                <br />
                <small>Generated QR code will appear here</small>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}