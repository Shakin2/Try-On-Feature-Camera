import React, { useRef, useState } from 'react';
import { ImageData } from '../types';
import { fileToBase64 } from '../services/utils';

interface FileUploadProps {
  onFileSelect: (data: ImageData) => void;
  label: string;
  accept?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, label, accept = "image/*" }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const data = await fileToBase64(e.target.files[0]);
        onFileSelect(data);
      } catch (err) {
        console.error("Error processing file", err);
      }
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      try {
        const data = await fileToBase64(e.dataTransfer.files[0]);
        onFileSelect(data);
      } catch (err) {
        console.error("Error processing dropped file", err);
      }
    }
  };

  return (
    <div 
      className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer group
        ${isDragging ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-600 hover:border-indigo-400 hover:bg-slate-800/50'}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input 
        type="file" 
        ref={inputRef} 
        className="hidden" 
        accept={accept} 
        onChange={handleFileChange} 
      />
      <div className="flex flex-col items-center gap-3">
        <div className="p-3 bg-slate-800 rounded-full group-hover:bg-slate-700 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-indigo-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        </div>
        <p className="text-slate-300 font-medium">{label}</p>
        <p className="text-xs text-slate-500">Supports JPG, PNG</p>
      </div>
    </div>
  );
};
