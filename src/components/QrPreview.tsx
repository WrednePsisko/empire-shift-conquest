import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Smartphone } from "lucide-react";

export function QrPreview() {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [url, setUrl] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = window.location.origin;
    setUrl(u);
    QRCode.toDataURL(u, {
      margin: 1,
      width: 260,
      color: { dark: "#0a0a0a", light: "#ffffff" },
    })
      .then(setDataUrl)
      .catch(() => setDataUrl(null));
  }, []);

  if (!dataUrl) return null;

  return (
    <div className="mt-6 flex flex-col items-center gap-2 rounded-2xl border border-border/60 bg-card/80 backdrop-blur p-4 shadow-xl">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
        <Smartphone className="size-3.5 text-primary" /> Play on Mobile
      </div>
      <img
        src={dataUrl}
        alt="QR code to open game on phone"
        className="rounded-lg w-[140px] h-[140px] bg-white p-1"
      />
      <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[200px]">{url}</div>
    </div>
  );
}
