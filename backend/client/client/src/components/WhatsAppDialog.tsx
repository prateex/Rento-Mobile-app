// Custom lightweight modal to avoid Radix context issues
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { MessageCircle, Copy, Check } from 'lucide-react';
import { formatWhatsAppMessage, getWhatsAppShareUrl } from '@/lib/utils';
import { Booking, Customer, Bike } from '@/lib/store';

interface WhatsAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  booking: Booking;
  customer: Customer;
  bikes: Bike[];
  template: string;
  onSent?: (message: string) => void;
}

export function WhatsAppDialog({
  open,
  onOpenChange,
  title,
  description,
  booking,
  customer,
  bikes,
  template,
  onSent
}: WhatsAppDialogProps) {
  const [message, setMessage] = useState(formatWhatsAppMessage(template, booking, customer, bikes));
  const [copied, setCopied] = useState(false);

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendViaWhatsApp = () => {
    try {
      const phoneNumber = customer.phone.replace(/\D/g, '');
      const whatsappUrl = getWhatsAppShareUrl(phoneNumber, message);
      const newWindow = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      if (newWindow === null) {
        // Fallback if popup is blocked
        window.location.href = whatsappUrl;
      }
      onSent?.(message);
      onOpenChange(false);
    } catch (error) {
      console.error('Error opening WhatsApp:', error);
    }
  };

  return (
    open ? (
      <div className="fixed inset-0 z-50">
        <div className="fixed inset-0 bg-black/80" onClick={() => onOpenChange(false)} />
        <div className="fixed left-[50%] top-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg sm:rounded-lg">
          <div className="flex flex-col space-y-1.5 text-center sm:text-left">
            <div className="text-lg font-semibold leading-none tracking-tight flex items-center gap-2">
              <MessageCircle size={20} className="text-green-600" />
              {title}
            </div>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>

          <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Message Preview</label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[150px] text-sm resize-none"
              placeholder="Message will appear here..."
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyMessage}
              className="gap-2"
            >
              {copied ? (
                <>
                  <Check size={16} />
                  Copied!
                </>
              ) : (
                <>
                  <Copy size={16} />
                  Copy Message
                </>
              )}
            </Button>
            <Button
              size="sm"
              onClick={handleSendViaWhatsApp}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              <MessageCircle size={16} />
              Send via WhatsApp
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            💡 Click "Send via WhatsApp" to open WhatsApp Web or mobile app with this message pre-filled.
          </p>
          <button
            aria-label="Close"
            className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100"
            onClick={() => onOpenChange(false)}
          >
            ✕
          </button>
          </div>
        </div>
      </div>
    ) : null
  );
}
