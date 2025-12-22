import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Damage } from "@/lib/store";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useState } from "react";

interface DamagePhotoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  damages: Damage[];
  title?: string;
}

export function DamagePhotoModal({ open, onOpenChange, damages, title = "Damage Photos" }: DamagePhotoModalProps) {
  const [currentDamageIndex, setCurrentDamageIndex] = useState(0);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  if (!damages || damages.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <p className="text-muted-foreground">No damage photos available</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const currentDamage = damages[currentDamageIndex];
  const currentPhoto = currentDamage?.photoUrls?.[currentPhotoIndex];
  const totalPhotos = currentDamage?.photoUrls?.length || 0;

  const goToPreviousPhoto = () => {
    if (currentPhotoIndex > 0) {
      setCurrentPhotoIndex(currentPhotoIndex - 1);
    }
  };

  const goToNextPhoto = () => {
    if (currentPhotoIndex < totalPhotos - 1) {
      setCurrentPhotoIndex(currentPhotoIndex + 1);
    }
  };

  const goToPreviousDamage = () => {
    if (currentDamageIndex > 0) {
      setCurrentDamageIndex(currentDamageIndex - 1);
      setCurrentPhotoIndex(0);
    }
  };

  const goToNextDamage = () => {
    if (currentDamageIndex < damages.length - 1) {
      setCurrentDamageIndex(currentDamageIndex + 1);
      setCurrentPhotoIndex(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex justify-between items-start">
            <DialogTitle>{title}</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 -mt-2"
              onClick={() => onOpenChange(false)}
            >
              <X size={16} />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Damage Info */}
          <div className="bg-zinc-50 p-3 rounded-lg text-sm space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold">{currentDamage.type}</p>
                <p className="text-xs text-muted-foreground">{currentDamage.notes || "No description"}</p>
              </div>
              <Badge variant={currentDamage.severity === 'major' ? 'destructive' : 'secondary'}>
                {currentDamage.severity}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Damage #{currentDamageIndex + 1} of {damages.length}
            </p>
          </div>

          {/* Photo Display */}
          {currentPhoto ? (
            <div className="space-y-3">
              <div className="relative bg-black rounded-lg overflow-hidden aspect-square flex items-center justify-center">
                <img
                  src={currentPhoto}
                  alt={`${currentDamage.type} photo ${currentPhotoIndex + 1}`}
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Photo Navigation */}
              {totalPhotos > 1 && (
                <div className="flex justify-between items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPhotoIndex === 0}
                    onClick={goToPreviousPhoto}
                    className="h-8"
                  >
                    <ChevronLeft size={16} /> Prev
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Photo {currentPhotoIndex + 1} of {totalPhotos}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPhotoIndex === totalPhotos - 1}
                    onClick={goToNextPhoto}
                    className="h-8"
                  >
                    Next <ChevronRight size={16} />
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-zinc-100 rounded-lg aspect-square flex items-center justify-center">
              <p className="text-sm text-muted-foreground">No photo for this damage</p>
            </div>
          )}

          {/* Damage Navigation */}
          {damages.length > 1 && (
            <div className="flex justify-between items-center gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                disabled={currentDamageIndex === 0}
                onClick={goToPreviousDamage}
                className="h-8"
              >
                <ChevronLeft size={16} /> Prev Damage
              </Button>
              <span className="text-xs text-muted-foreground">
                Damage {currentDamageIndex + 1} of {damages.length}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentDamageIndex === damages.length - 1}
                onClick={goToNextDamage}
                className="h-8"
              >
                Next Damage <ChevronRight size={16} />
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
