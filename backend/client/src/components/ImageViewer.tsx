import { useState, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, ZoomIn, ZoomOut, Download, RotateCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ImageViewerProps {
  src: string;
  open: boolean;
  onClose: () => void;
  title?: string;
}

export function ImageViewer({ src, open, onClose, title }: ImageViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const { toast } = useToast();

  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev - 0.25, 0.5));
  }, []);

  const handleRotate = useCallback(() => {
    setRotation(prev => (prev + 90) % 360);
  }, []);

  const handleDownload = useCallback(async () => {
    try {
      // For blob URLs, we can fetch and download
      if (src.startsWith('blob:')) {
        const response = await fetch(src);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `image-${Date.now()}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast({ title: 'Downloaded', description: 'Image saved to gallery' });
      } else {
        // For regular URLs, open in new tab (browser will handle download)
        const a = document.createElement('a');
        a.href = src;
        a.download = `image-${Date.now()}.jpg`;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast({ title: 'Downloaded', description: 'Image opened in new tab' });
      }
    } catch (error) {
      toast({ title: 'Download Failed', description: 'Could not save image', variant: 'destructive' });
    }
  }, [src, toast]);

  const handleReset = useCallback(() => {
    setZoom(1);
    setRotation(0);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 overflow-hidden bg-black/95">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/70 to-transparent">
          {title && <h3 className="text-white text-sm font-medium">{title}</h3>}
          <div className="flex-1"></div>
          <Button
            size="icon"
            variant="ghost"
            className="text-white hover:bg-white/20 h-8 w-8"
            onClick={onClose}
          >
            <X size={20} />
          </Button>
        </div>

        {/* Image Container */}
        <div className="flex items-center justify-center w-full h-full min-h-[60vh] overflow-auto p-16">
          <img
            src={src}
            alt={title || 'Image'}
            className="max-w-full max-h-full object-contain transition-transform duration-200"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
            }}
            onClick={handleReset}
          />
        </div>

        {/* Controls Footer */}
        <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-center gap-2 p-4 bg-gradient-to-t from-black/70 to-transparent">
          <Button
            size="icon"
            variant="ghost"
            className="text-white hover:bg-white/20 h-10 w-10"
            onClick={handleZoomOut}
            disabled={zoom <= 0.5}
          >
            <ZoomOut size={20} />
          </Button>
          
          <div className="text-white text-sm font-mono min-w-[60px] text-center">
            {Math.round(zoom * 100)}%
          </div>
          
          <Button
            size="icon"
            variant="ghost"
            className="text-white hover:bg-white/20 h-10 w-10"
            onClick={handleZoomIn}
            disabled={zoom >= 3}
          >
            <ZoomIn size={20} />
          </Button>
          
          <div className="w-px h-6 bg-white/30 mx-2"></div>
          
          <Button
            size="icon"
            variant="ghost"
            className="text-white hover:bg-white/20 h-10 w-10"
            onClick={handleRotate}
          >
            <RotateCw size={20} />
          </Button>
          
          <Button
            size="icon"
            variant="ghost"
            className="text-white hover:bg-white/20 h-10 w-10"
            onClick={handleDownload}
          >
            <Download size={20} />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
