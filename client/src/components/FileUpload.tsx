import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";

interface FileUploadProps {
  onFileSelect: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  children: React.ReactNode;
  className?: string;
  selectedFiles?: File[];
  onRemoveFile?: (index: number) => void;
}

export default function FileUpload({ 
  onFileSelect, 
  accept, 
  multiple = false, 
  children, 
  className = "",
  selectedFiles = [],
  onRemoveFile
}: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    onFileSelect(files);
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        onClick={handleButtonClick}
        className={`btn-primary ${className}`}
        data-testid="file-upload-button"
      >
        {children}
      </Button>
      
      {selectedFiles.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {selectedFiles.map((file, index) => (
            <div key={index} className="flex items-center gap-1">
              <span className="text-dark-muted text-xs max-w-48 truncate" data-testid={`selected-file-${index}`}>
                {file.name}
              </span>
              {onRemoveFile && (
                <button
                  type="button"
                  onClick={() => onRemoveFile(index)}
                  className="file-upload-x"
                  title="Remove file"
                  data-testid={`remove-file-${index}`}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      
      {selectedFiles.length === 0 && (
        <span className="text-dark-muted text-xs" data-testid="no-files-selected">
          No files selected
        </span>
      )}

      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileChange}
        accept={accept}
        multiple={multiple}
        className="hidden"
        data-testid="file-input"
      />
    </div>
  );
}
