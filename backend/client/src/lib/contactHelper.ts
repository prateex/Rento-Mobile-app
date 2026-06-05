/**
 * Helper utility to export customer contact as VCF file
 */

export interface ContactInfo {
  name: string;
  phone: string;
  email?: string;
  address?: string;
}

/**
 * Generates a VCF (vCard) file content string
 */
export function generateVCF(contact: ContactInfo): string {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${contact.name}`,
    `TEL;TYPE=CELL:${contact.phone}`,
  ];

  if (contact.email) {
    lines.push(`EMAIL:${contact.email}`);
  }

  if (contact.address) {
    lines.push(`ADR:;;${contact.address};;;;`);
  }

  lines.push('END:VCARD');

  return lines.join('\r\n');
}

/**
 * Downloads a VCF file to the user's device
 */
export function downloadVCF(contact: ContactInfo): void {
  const vcfContent = generateVCF(contact);
  const blob = new Blob([vcfContent], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  // Sanitize filename
  const filename = contact.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  link.href = url;
  link.download = `${filename}.vcf`;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
