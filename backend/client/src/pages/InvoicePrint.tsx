import { useEffect, useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useStore, Invoice } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Printer, AlertCircle, MessageCircle, ArrowLeft } from 'lucide-react';

export default function InvoicePrint() {
  const [route, params] = useRoute('/invoice/:bookingId');
  const [, navigate] = useLocation();
  const { getInvoiceByBookingId, bookings, customers, bikes, shopDetails } = useStore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);

  const bookingId = params?.bookingId || '';
  const booking = bookingId ? bookings.find(b => b.id === bookingId) : null;
  
  // Try to get invoice from store, or build from booking if it has invoiceNumber
  let invoice = bookingId ? getInvoiceByBookingId(bookingId) : null;
  
  // If invoice not in store but booking has invoiceNumber, build invoice object
  if (!invoice && booking && booking.invoiceNumber) {
    const customer = customers.find(c => c.id === booking.customerId);
    const bookingBikes = bikes.filter(b => booking.bikeIds?.includes(b.id));
    
    if (customer && bookingBikes.length > 0) {
      invoice = {
        id: `inv-${booking.id}`,
        invoiceNumber: booking.invoiceNumber,
        bookingId: booking.id,
        customerSnapshot: {
          name: customer.name,
          phone: customer.phone
        },
        vehiclesSnapshot: bookingBikes.map(bike => ({
          name: bike.name,
          regNo: bike.regNo
        })),
        startDate: booking.startDate,
        endDate: booking.endDate,
        rent: booking.rent,
        deposit: booking.deposit,
        depositDeduction: booking.depositDeduction || 0,
        // Total = Rent + Deposit - Refund
        refundAmount: Math.max(0, (booking.deposit || 0) - (booking.depositDeduction || 0)),
        totalPayable: (booking.rent || 0) + (booking.deposit || 0) - Math.max(0, (booking.deposit || 0) - (booking.depositDeduction || 0)),
        generatedAt: booking.invoiceGeneratedAt || booking.returnedAt || new Date().toISOString(),
        generatedBy: booking.invoiceGeneratedBy || 'system'
      };
    }
  }

  const companyName = shopDetails?.name || 'City Bike Rentals';
  const companyPhone = shopDetails?.phone || '+91 99999 99999';
  const companyEmail = shopDetails?.email || 'support@citybikerentals.local';
  const companyAddress = shopDetails?.address || '123 MG Road, Bengaluru, KA';

  useEffect(() => {
    setIsLoading(false);
  }, []);

  if (!route) return null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!invoice || !booking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
        <Card className="w-full max-w-md p-6">
          <div className="flex flex-col items-center gap-4">
            <AlertCircle className="h-12 w-12 text-red-500" />
            <h2 className="text-lg font-semibold">Invoice Not Found</h2>
            <p className="text-sm text-gray-600 text-center">
              The invoice you're looking for doesn't exist or hasn't been generated yet.
            </p>
            <Button variant="outline" onClick={() => window.history.back()}>
              Go Back
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  const handleSendWhatsApp = () => {
    const customerName = invoice.customerSnapshot.name || 'Customer';
    const customerPhoneRaw = invoice.customerSnapshot.phone || '';
    const customerPhone = customerPhoneRaw.replace(/\D/g, '');

    if (!customerPhone) {
      toast({
        variant: 'destructive',
        title: 'Phone number missing',
        description: 'Add a customer phone number to send via WhatsApp.',
      });
      return;
    }

    const startDate = new Date(invoice.startDate).toLocaleDateString('en-IN');
    const endDate = new Date(invoice.endDate).toLocaleDateString('en-IN');
    const message = `Hello ${customerName},\n\nYour rental invoice is ready.\n\nInvoice No: ${invoice.invoiceNumber}\nBooking ID: ${booking.bookingNumber || booking.id}\nRental Period: ${startDate} – ${endDate}\nTotal Amount: ₹${invoice.totalPayable.toLocaleString('en-IN')}\n\nPlease find the invoice PDF attached.\n\nThank you,\nRento Rentals`;

    const encoded = encodeURIComponent(message);
    const url = `https://wa.me/${customerPhone}?text=${encoded}`;
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Print Button - Hidden in Print Mode */}
      <div className="flex justify-between items-center mb-6 print:hidden">
        <Button 
          variant="outline"
          onClick={() => navigate('/bookings')}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Bookings
        </Button>
        <div className="flex gap-2">
          <Button 
            onClick={handlePrint}
            className="flex items-center gap-2"
          >
            <Printer className="h-4 w-4" />
            Print / Save as PDF
          </Button>
          <Button
            onClick={handleSendWhatsApp}
            className="flex items-center gap-2"
          >
            <MessageCircle className="h-4 w-4" />
            Send via WhatsApp
          </Button>
        </div>
      </div>

      {/* A4 Invoice Layout */}
      <div className="max-w-4xl mx-auto bg-white p-8 print:p-0 print:max-w-full shadow-lg print:shadow-none">
        {/* Header */}
        <div className="flex justify-between items-start mb-8 pb-8 border-b-2 border-gray-200">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {companyName}
            </h1>
            <p className="text-sm text-gray-600 mt-1">{companyAddress}</p>
            <p className="text-sm text-gray-600">{companyPhone}</p>
            <p className="text-sm text-gray-600">{companyEmail}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900">INVOICE</p>
            <p className="text-sm text-gray-600 mt-2">
              Invoice #: <span className="font-semibold">{invoice.invoiceNumber}</span>
            </p>
            <p className="text-sm text-gray-600">
              Date: <span className="font-semibold">{new Date(invoice.generatedAt).toLocaleDateString('en-IN')}</span>
            </p>
          </div>
        </div>

        {/* Bill To */}
        <div className="mb-8">
          <p className="text-sm font-semibold text-gray-900 mb-2">BILL TO:</p>
          <div className="bg-gray-50 p-4 rounded">
            <p className="text-sm font-semibold text-gray-900">
              {invoice.customerSnapshot.name}
            </p>
            <p className="text-sm text-gray-600">
              Phone: {invoice.customerSnapshot.phone}
            </p>
            <p className="text-sm text-gray-600">
               Booking ID: {booking.bookingNumber || booking.id}
             </p>
          </div>
        </div>

        {/* Rental Details */}
        <div className="mb-8">
          <p className="text-sm font-semibold text-gray-900 mb-3">RENTAL DETAILS:</p>
          <div className="bg-gray-50 rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-200 border-b border-gray-300">
                  <th className="px-4 py-2 text-left font-semibold text-gray-900">Vehicle</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-900">Registration</th>
                </tr>
              </thead>
              <tbody>
                {invoice.vehiclesSnapshot.map((vehicle, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-2 text-gray-700">{vehicle.name}</td>
                    <td className="px-4 py-2 text-gray-700">{vehicle.regNo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Rental Period */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-blue-50 p-4 rounded border border-blue-200">
            <p className="text-xs font-semibold text-blue-900 mb-1">START DATE & TIME</p>
            <p className="text-sm font-semibold text-gray-900">
              {new Date(invoice.startDate).toLocaleDateString('en-IN')}
            </p>
            <p className="text-xs text-gray-600">
              {new Date(invoice.startDate).toLocaleTimeString('en-IN', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </p>
          </div>
          <div className="bg-blue-50 p-4 rounded border border-blue-200">
            <p className="text-xs font-semibold text-blue-900 mb-1">END DATE & TIME</p>
            <p className="text-sm font-semibold text-gray-900">
              {new Date(invoice.endDate).toLocaleDateString('en-IN')}
            </p>
            <p className="text-xs text-gray-600">
              {new Date(invoice.endDate).toLocaleTimeString('en-IN', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </p>
          </div>
        </div>

        {/* Amount Summary */}
        <div className="mb-8">
          <div className="bg-gray-50 rounded overflow-hidden border border-gray-200">
            {/* Rent Amount */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
              <span className="text-sm font-medium text-gray-900">Rent Amount</span>
              <span className="text-sm font-semibold text-gray-900">₹{invoice.rent.toLocaleString('en-IN')}</span>
            </div>

            {/* Security Deposit */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 bg-white">
              <span className="text-sm font-medium text-gray-900">Security Deposit Collected</span>
              <span className="text-sm font-semibold text-gray-900">₹{invoice.deposit.toLocaleString('en-IN')}</span>
            </div>

            {/* Deposit Deduction */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
              <span className={`text-sm font-medium ${invoice.depositDeduction > 0 ? 'text-red-900' : 'text-gray-900'}`}>
                Deposit Deduction (Damages)
              </span>
              <span className={`text-sm font-semibold ${invoice.depositDeduction > 0 ? 'text-red-600' : 'text-gray-700'}`}>
                -₹{invoice.depositDeduction.toLocaleString('en-IN')}
              </span>
            </div>

            {/* Total Payable */}
            <div className="flex justify-between items-center px-6 py-4 bg-gray-900">
              <span className="text-sm font-bold text-white">TOTAL PAYABLE</span>
              <span className="text-lg font-bold text-white">₹{invoice.totalPayable.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Summary Note */}
        <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-8">
          <p className="text-xs text-blue-900 leading-relaxed">
            <span className="font-semibold">Payment Summary:</span> Rent amount of ₹{invoice.rent.toLocaleString('en-IN')} is due. 
            Security deposit of ₹{invoice.deposit.toLocaleString('en-IN')} has been collected and will be refunded after deducting any damages.
            {invoice.depositDeduction > 0 
              ? ` Damages amounting to ₹${invoice.depositDeduction.toLocaleString('en-IN')} have been identified and will be deducted from the deposit.`
              : ' No damages reported; full deposit is refundable.'}
          </p>
        </div>

        {/* Footer */}
        <div className="border-t-2 border-gray-200 pt-8 text-center">
          <p className="text-xs text-gray-600 mb-2">
            System generated invoice — no signature required.
          </p>
          <p className="text-xs text-gray-500 mb-4">
            Generated on {new Date(invoice.generatedAt).toLocaleDateString('en-IN')} at {new Date(invoice.generatedAt).toLocaleTimeString('en-IN')}
          </p>
          <p className="text-xs text-gray-600 font-semibold">
            Thank you for choosing {shopDetails?.name || 'us'}!
          </p>
        </div>

        {/* Print-only footer page break */}
        <div className="mt-12 pt-8 border-t-2 border-gray-200 text-center print:mt-16">
          <p className="text-xs text-gray-500">
            Invoice #: {invoice.invoiceNumber}
          </p>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
            background: white;
          }
          
          html {
            margin: 0;
            padding: 0;
          }
          
          * {
            box-sizing: border-box;
          }
          
          @page {
            size: A4;
            margin: 1cm;
          }
          
          .max-w-4xl {
            max-width: 210mm;
            height: 297mm;
            padding: 1cm;
            margin: 0 auto;
          }
          
          /* Remove unwanted elements */
          nav, header, footer, .print\\:hidden {
            display: none !important;
          }
        }
        
        /* Screen view optimizations */
        @media screen {
          .print\\:p-0,
          .print\\:max-w-full,
          .print\\:shadow-none,
          .print\\:mt-16 {
            /* handled by Tailwind */
          }
        }
      `}</style>
    </div>
  );
}
