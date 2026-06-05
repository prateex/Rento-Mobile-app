import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Booking, Customer, Bike, useStore } from "@/lib/store";
import { safeArray } from "@/lib/safe";
import { FileDown, MessageCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface InvoicePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: Booking | null;
  customer?: Customer;
  bikes?: Bike[];
  onSaveAsPdf?: () => Promise<void>;
  onSendWhatsApp?: () => void;
}

export function InvoicePreviewModal({
  open,
  onOpenChange,
  booking,
  customer,
  bikes = [],
  onSaveAsPdf,
  onSendWhatsApp,
}: InvoicePreviewModalProps) {
  const { toast } = useToast();
  const { shopDetails } = useStore();

  if (!booking) {
    return null;
  }

  const handleSavePdf = async () => {
    try {
      if (onSaveAsPdf) {
        await onSaveAsPdf();
        toast({
          title: "Success",
          description: "Invoice saved as PDF",
        });
      } else {
        // Fallback: Print to PDF using browser
        window.print();
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save PDF",
      });
    }
  };

  const handleSendWhatsApp = () => {
    if (onSendWhatsApp) {
      onSendWhatsApp();
    } else {
      // Fallback: Generate WhatsApp message with shop details
      const bikeNames = bikes.filter(b => safeArray<string>(booking.bikeIds).includes(b.id)).map(b => b.name).join(', ') || 'Unknown';
      const shopName = shopDetails.name || 'Rental Shop';
      const shopPhone = shopDetails.phone ? `\nContact: ${shopDetails.phone}` : '';
      const shopAddress = shopDetails.address ? `\nAddress: ${shopDetails.address}` : '';
      const gst = shopDetails.gstNumber ? `\nGST: ${shopDetails.gstNumber}` : '';
      
      const message = `*${shopName}*${shopPhone}${shopAddress}${gst}\n\n*Invoice for Booking #${booking.bookingNumber}*\n\nVehicle: ${bikeNames}\nCustomer: ${customerName}\nFrom: ${booking.startDate}\nTo: ${booking.endDate}\nRent: ₹${rent}\nTotal: ₹${booking.totalAmount || booking.rent}\n\nThank you for your business!`;
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, "_blank");
    }
    toast({
      title: "Success",
      description: "Opening WhatsApp to send invoice",
    });
  };

  const handleGenerateLater = () => {
    toast({
      title: "Invoice Saved",
      description: "Invoice will be generated and sent when bike is returned",
    });
    onOpenChange(false);
  };

  // Get bike and customer names
  const bikeNames = bikes.filter(b => safeArray<string>(booking.bikeIds).includes(b.id)).map(b => b.name).join(', ') || 'Unknown';
  const customerName = customer?.name || 'Customer';
  const customerPhone = customer?.phone || 'N/A';

  // Calculate invoice details using: Total = Rent + Deposit - Refund
  const rent = booking.rent || 0;
  const deposit = booking.deposit || 0;
  const advanceAmount = booking.advanceAmount || 0;
  const remainingAmount = booking.remainingAmount || rent - advanceAmount;
  const depositDeduction = booking.depositDeduction || 0;
  const depositRefund = Math.max(0, deposit - depositDeduction);
  const totalAmount = rent + deposit - depositRefund;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invoice Preview</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Shop Header */}
          <div className="bg-gradient-to-r from-[hsl(49,100%,50%)] to-amber-500 text-black rounded-lg p-4">
            <h2 className="text-xl font-bold">{shopDetails.name || 'Rental Shop'}</h2>
            {shopDetails.address && <p className="text-sm mt-1">{shopDetails.address}</p>}
            <div className="flex gap-4 mt-2 text-sm">
              {shopDetails.phone && <span>📞 {shopDetails.phone}</span>}
              {shopDetails.email && <span>✉️ {shopDetails.email}</span>}
            </div>
            {shopDetails.gstNumber && (
              <p className="text-sm mt-1 font-medium">GST: {shopDetails.gstNumber}</p>
            )}
          </div>
          
          {/* Invoice Header */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-bold text-lg">INVOICE</h3>
                  <p className="text-sm text-muted-foreground">
                    {booking.invoiceNumber ? `Invoice #${booking.invoiceNumber}` : 'Invoice (Not Yet Generated)'}
                  </p>
              </div>
              <div className="text-right text-sm">
                <p className="font-semibold">{new Date().toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          {/* Booking Details */}
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs uppercase font-semibold">Booking Information</p>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <p className="text-xs text-muted-foreground">Booking ID</p>
                  <p className="font-medium">{booking.id?.slice(0, 8)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Customer</p>
                  <p className="font-medium">{customerName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Bike</p>
                  <p className="font-medium">{bikeNames}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="font-medium">{customerPhone}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Rental Period */}
            <div>
              <p className="text-muted-foreground text-xs uppercase font-semibold">Rental Period</p>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <p className="text-xs text-muted-foreground">Start Date</p>
                  <p className="font-medium">{booking.startDate}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">End Date</p>
                  <p className="font-medium">{booking.endDate}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Amount Details */}
            <div>
              <p className="text-muted-foreground text-xs uppercase font-semibold mb-2">Amount Details</p>
              <div className="bg-zinc-50 rounded p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Rental Amount</span>
                  <span className="font-medium">₹{rent.toLocaleString()}</span>
                </div>
                {advanceAmount > 0 && (
                  <div className="flex justify-between text-sm text-green-700 bg-green-50 p-2 rounded">
                    <span>Advance Paid</span>
                    <span className="font-medium">-₹{advanceAmount.toLocaleString()}</span>
                  </div>
                )}
                {remainingAmount > 0 && (
                  <div className="flex justify-between text-sm text-amber-700 bg-amber-50 p-2 rounded">
                    <span>Remaining Due</span>
                    <span className="font-medium">₹{remainingAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm border-t pt-2">
                  <span>Tax (GST @10%)</span>
                  <span className="font-medium">₹{tax.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-bold text-base border-t pt-2">
                  <span>Total Amount</span>
                  <span className="text-blue-600">₹{totalAmount.toLocaleString()}</span>
                </div>
                  {deposit > 0 && (
                    <div className="flex justify-between text-sm border-t pt-2 text-purple-700">
                      <span>Security Deposit (Held Separately)</span>
                      <span className="font-medium">₹{deposit.toLocaleString()}</span>
                    </div>
                  )}
                  {depositDeduction > 0 && (
                    <div className="flex justify-between text-sm text-red-600">
                      <span>Deposit Deduction</span>
                      <span className="font-medium">-₹{depositDeduction.toLocaleString()}</span>
                    </div>
                  )}
                  {/* Deposit refund is calculated implicitly in total; no separate row to avoid confusion */}
              </div>
            </div>

            <Separator />

            {/* Payment Status */}
            <div>
              <p className="text-muted-foreground text-xs uppercase font-semibold mb-2">Status</p>
              <div className="bg-zinc-50 rounded p-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Payment Status</span>
                  <span className="text-sm font-medium px-3 py-1 rounded-full bg-blue-100 text-blue-800">
                    {booking.status || "Pending"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            <Button
              variant="default"
              className="w-full"
              onClick={handleSavePdf}
            >
              <FileDown size={16} className="mr-2" />
              Save as PDF
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleSendWhatsApp}
            >
              <MessageCircle size={16} className="mr-2" />
              Send via WhatsApp
            </Button>
              {!booking.invoiceNumber && (
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={handleGenerateLater}
                >
                  <Clock size={16} className="mr-2" />
                  Generate Invoice Later
                </Button>
              )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
