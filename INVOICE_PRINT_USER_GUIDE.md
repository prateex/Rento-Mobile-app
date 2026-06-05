# Printable Invoice - Quick Start Guide

## Feature Overview

Users can now generate invoices and save them as PDFs using the browser's native print dialog.

**No PDF library, No Supabase, No backend - Pure HTML + Browser Print**

---

## How It Works

### 1. Generate Invoice (Existing Flow)

Complete a booking through Return Flow:
1. Click "Return Vehicle" on Active booking
2. Enter closing odometer
3. Add damages if needed
4. Enter deposit deduction (e.g., ₹500)
5. Click "Generate Invoice"
6. Booking → Completed, Button → Green ✓

### 2. View Invoice (NEW)

Click the green FileText button:
- Opens `/invoice/{bookingId}` page
- Full-page A4 invoice layout
- Professional formatting
- All details visible

### 3. Print / Save as PDF (NEW)

On the invoice page:
- Click **"Print / Save as PDF"** button
- Browser print dialog opens
- Select **"Save as PDF"**
- Choose location
- Save ✓

---

## Invoice Contents

When printed, the invoice includes:

```
┌─────────────────────────────────────────┐
│  COMPANY DETAILS                        │
│  Bike Rental                            │  ← From Settings
│  Address                                │
│  Phone                                  │
│                                         │
│                              INVOICE    │
│                              #INV-...   │
│                              Date       │
├─────────────────────────────────────────┤
│ BILL TO:                                │
│ Customer Name                           │
│ Phone Number                            │
├─────────────────────────────────────────┤
│ RENTAL DETAILS:                         │
│ Vehicle 1         | Reg No              │
│ Vehicle 2         | Reg No              │
│ Start: Apr 01, 10:00 → End: Apr 03, 14:00
├─────────────────────────────────────────┤
│ Rent Amount              ₹5,000          │
│ Security Deposit         ₹3,000          │
│ Deposit Deduction        -₹500  (red)    │
│ Deposit Refund            ₹2,500 (green) │
├─────────────────────────────────────────┤
│ TOTAL PAYABLE            ₹4,500          │
└─────────────────────────────────────────┘
```

---

## Browser-Specific Instructions

### Chrome
1. Click "Print / Save as PDF" on invoice
2. Printer dropdown → **"Save as PDF"**
3. Click **"Save"**
4. Choose folder, done ✓

### Firefox
1. Click "Print / Save as PDF" on invoice
2. **"Print to File"** option
3. Click **"Print"**
4. Choose folder, done ✓

### Safari (Mac)
1. Click "Print / Save as PDF" on invoice
2. Click **"PDF"** dropdown
3. Select **"Save as PDF"**
4. Choose folder, done ✓

### Safari (iPad)
1. Click "Print / Save as PDF" on invoice
2. Tap **"PDF"** button
3. Tap **"Save to Files"**
4. Choose folder, done ✓

### Edge
1. Click "Print / Save as PDF" on invoice
2. Printer dropdown → **"Save as PDF"**
3. Click **"Save"**
4. Choose folder, done ✓

---

## Data Security

✅ **Everything stays local:**
- No data sent to server
- Invoice stays in browser storage
- PDF saved locally on device
- Works completely offline
- Share only via email/WhatsApp manually

---

## Invoice Accuracy

All numbers on the PDF are calculated from:
- **Rent Amount**: From booking
- **Deposit Collected**: From booking
- **Deposit Deduction**: From Return Flow
- **Deposit Refund**: Deposit - Deduction (calculated)
- **Total Payable**: Rent - Deduction (calculated)

Customer & vehicle details are **snapshotted** when invoice is generated (frozen in time).

---

## Troubleshooting

### Invoice Button Not Showing
**Problem:** Gray file icon not appearing
**Solution:**
- Booking must be completed (status: 'Completed')
- User must be Admin/Owner

### Cannot Generate Invoice
**Problem:** "Generate Invoice" dialog appears but button doesn't work
**Solution:**
- Deposit deduction must be entered in Return Flow
- Go back to booking, use "Return Vehicle" flow again
- Make sure to enter a deduction amount

### Invoice Page Shows Error
**Problem:** "Invoice Not Found" error
**Solutions:**
- Invoice hasn't been generated yet (use gray button first)
- Booking ID is invalid
- Invoice was deleted (hard refresh browser cache)

### Print Dialog Doesn't Appear
**Problem:** Clicking "Print / Save as PDF" does nothing
**Solutions:**
- Check browser pop-up blocker settings
- Allow pop-ups for this site
- Try different browser
- Restart browser

### PDF Looks Bad
**Problem:** Formatting wrong, text cut off, colors missing
**Solutions:**
- Check print preview before saving
- Adjust margins in print dialog (set to 1cm)
- Try printing to different PDF printer
- Disable background graphics in print settings

---

## PDF Quality Tips

### For Best Results:

1. **Disable Background Graphics**
   - Print settings → Uncheck "Background graphics"
   - Helps with colors and layout

2. **Set Margins to 1cm**
   - Print settings → More settings → Margins: 1cm
   - Ensures proper spacing

3. **Use Landscape** (Optional)
   - For wider invoices with more details
   - Not necessary, portrait works fine

4. **Check Print Preview**
   - Always check preview before saving
   - Verify all content visible and properly formatted

---

## Sharing Invoices

### Email
1. Save as PDF (see instructions above)
2. Attach PDF to email
3. Send to customer

### WhatsApp
1. Save as PDF
2. Open WhatsApp
3. Share the PDF file
4. Send to customer

### Phone Transfer
1. Save to cloud (Google Drive, OneDrive, etc.)
2. Share link with customer
3. Or transfer via Bluetooth/AirDrop

### Printing
1. Open PDF file
2. Click Print
3. Select printer
4. Print on paper

---

## Keyboard Shortcuts

### Print Dialog
- **Ctrl+P** or **Cmd+P**: Open print dialog quickly
- **Escape**: Close print dialog

### Invoice Page
- **Back Button**: Return to bookings list
- **Refresh**: Reload invoice (F5 or Cmd+R)

---

## Data Persistence

### Invoices Stay Available:
- After browser refresh ✓
- After closing tab/window ✓
- After restart ✓
- On same device ✓

### Invoices Lost When:
- Browser cache cleared
- Browser data deleted
- Uninstall and reinstall app
- Switch to different device
- (They're local only, no cloud backup)

### Backup Invoices:
- Save PDFs to cloud storage
- Email PDFs to yourself
- Print to paper
- Export from Reports page (future feature)

---

## For Business Use

### Invoice Number Format
- **INV-YYMM-XXXX**
- Example: INV-25260001
- Unique per fiscal year
- Auto-increments
- Auto-resets April 1st

### Audit Trail
Each invoice shows:
- Invoice number (unique)
- Generation date/time
- Generated by user
- Customer & vehicle snapshots
- All amounts (frozen at generation)

### Tax Compliance
⚠️ **Important:**
- This system does NOT calculate GST
- User responsible for GST additions
- Invoice shows gross amounts only
- For GST: add 5% or 18% as applicable by regulation

---

## Mobile Usage

### On Smartphone:
1. Navigate to booking with invoice
2. Click green FileText button
3. Wait for invoice to load (full screen)
4. Click "Print / Save as PDF"
5. Choose "Save to Files" or "Save as PDF"
6. Done!

### On Tablet (iPad, Tab):
1. Same steps as above
2. Larger screen = better preview
3. Better for review before saving
4. Same print functionality

---

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Invoice button gray after generating | Refresh page (F5), try again |
| PDF saved but cannot open | Check file location, use PDF viewer app |
| Print preview shows blank | Reload page, try again |
| Margins look off in PDF | Adjust in print settings before saving |
| Colors not showing in PDF | Enable "Background graphics" in print settings |
| Invoice missing data | Verify booking completed with deposit deduction |
| Cannot find saved PDF | Check Downloads folder or recent files |

---

## Advanced Tips

### Batch PDF Creation
1. Don't use this method for multiple invoices
2. Better way: Use future Reports page export
3. Or manually save each one (takes a few minutes)

### Custom Printing
1. Open invoice page
2. Right-click → Inspect (F12)
3. Modify CSS in console if needed
4. Print from console (advanced users)

### Sharing via URL
1. Invoice page is a direct URL: `/invoice/{bookingId}`
2. Copy URL from address bar
3. Can share via chat/email
4. Recipient needs to be logged in
5. Opens same invoice view for them

---

## End User Tips

**Pro Tips:**

1. ✅ Save invoices immediately after generating
2. ✅ Organize PDFs in folders by month
3. ✅ Send WhatsApp message + PDF to customers
4. ✅ Keep physical copies for bookkeeping
5. ✅ Back up PDFs to cloud storage

**Don't:**

1. ❌ Delete booking after generating invoice
2. ❌ Modify booking after invoice generated (can't - locked)
3. ❌ Rely only on browser storage (might get cleared)
4. ❌ Share device/browser with other users without clearing data
5. ❌ Assume PDF backed up (it's only local unless you saved elsewhere)

---

## Support

For issues:
1. Check troubleshooting section above
2. Verify booking is completed
3. Check browser console (F12) for errors
4. Try different browser
5. Try clearing browser cache

---

## Summary

✅ **Works on:**
- All modern browsers
- Desktop computers
- Tablets
- Smartphones

✅ **Features:**
- Professional A4 layout
- Color-coded amounts
- Company branding
- All details included
- One-click PDF save

✅ **Reliability:**
- Local data (offline capable)
- Survives refresh
- No internet required
- No server dependency

**Status:** Ready to use! 🎉
