import { useState } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Check, Loader2, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from 'sonner';
import { cropImageToDataUrl, PRODUCT_IMAGE_ASPECT } from '../utils/image';

interface ImageCropDialogProps {
  // The image being cropped (data: URL). null keeps the dialog closed.
  imageSrc: string | null;
  onCancel: () => void;
  onConfirm: (croppedDataUrl: string) => void;
}

// Fixed-frame crop/reposition step between choosing a product photo and saving
// it, so pictures taken on different phones all end up at the same 4:3 ratio.
// Drag to reposition; pinch (touch) or the slider to zoom.
export default function ImageCropDialog({ imageSrc, onCancel, onConfirm }: ImageCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);

  const resetView = () => { setCrop({ x: 0, y: 0 }); setZoom(1); setCroppedAreaPixels(null); };

  const handleConfirm = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setProcessing(true);
    try {
      const cropped = await cropImageToDataUrl(imageSrc, croppedAreaPixels);
      onConfirm(cropped);
      resetView();
    } catch (err: any) {
      toast.error(err.message || 'Could not process the image. Please try another photo.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={imageSrc !== null} onOpenChange={(open) => { if (!open) { resetView(); onCancel(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adjust Photo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden bg-gray-900 touch-none">
            {imageSrc && (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={PRODUCT_IMAGE_ASPECT}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_area, areaPixels) => setCroppedAreaPixels(areaPixels)}
              />
            )}
          </div>

          <div className="flex items-center gap-3">
            <ZoomOut className="w-5 h-5 text-gray-500 shrink-0" />
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.05}
              onChange={(e) => setZoom(Number(e.target.value))}
              aria-label="Zoom"
              className="flex-1 h-2 accent-orange-500 cursor-pointer"
            />
            <ZoomIn className="w-5 h-5 text-gray-500 shrink-0" />
          </div>
          <p className="text-sm text-gray-600 text-center">Drag to reposition · pinch or slide to zoom</p>

          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => { resetView(); onCancel(); }} className="flex-1 h-12" disabled={processing}>
              Cancel
            </Button>
            <Button type="button" onClick={handleConfirm} className="flex-1 h-12 brand-button" disabled={processing || !croppedAreaPixels}>
              {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              Use Photo
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
