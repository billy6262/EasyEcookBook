import { useRef, useState } from "react";

interface Props {
  currentUrl?: string | null;
  onFileSelect: (file: File) => void;
  onUrlChange: (url: string) => void;
}

type Tab = "upload" | "url";

export default function CoverImageInput({ currentUrl, onFileSelect, onUrlChange }: Props) {
  const [tab, setTab] = useState<Tab>(currentUrl ? "url" : "upload");
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const [urlInput, setUrlInput] = useState(currentUrl ?? "");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    onFileSelect(file);
  };

  const applyUrl = () => {
    setPreview(urlInput || null);
    onUrlChange(urlInput);
  };

  const clearAll = () => {
    setPreview(null);
    setUrlInput("");
    onUrlChange("");
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-3">
      {/* Tab switcher */}
      <div className="flex border-b">
        {(["upload", "url"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm border-b-2 transition-colors ${
              tab === t
                ? "border-green-600 text-green-600 font-medium"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "upload" ? "Upload file" : "Paste URL"}
          </button>
        ))}
      </div>

      {tab === "upload" ? (
        <div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 text-center text-sm text-gray-400 hover:border-green-400 hover:text-green-600 transition-colors"
          >
            Click to choose an image (JPEG, PNG, WebP)
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onBlur={applyUrl}
            onKeyDown={(e) => e.key === "Enter" && applyUrl()}
            placeholder="https://example.com/image.jpg"
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            type="button"
            onClick={applyUrl}
            className="px-3 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            Preview
          </button>
        </div>
      )}

      {preview && (
        <div className="relative">
          <img
            src={preview}
            alt="Cover preview"
            className="w-full h-40 object-cover rounded-lg"
            onError={() => setPreview(null)}
          />
          <button
            type="button"
            onClick={clearAll}
            className="absolute top-2 right-2 bg-white rounded-full w-6 h-6 flex items-center justify-center shadow text-gray-500 hover:text-red-500 text-sm leading-none"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
