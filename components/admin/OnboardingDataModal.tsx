import React, { useRef } from 'react';
import jsPDF from 'jspdf';
import { 
  X, 
  Download, 
  FileText, 
  User, 
  Building, 
  Calendar,
} from 'lucide-react';
import localLogo from '@/public/logo.png'; // Import the logo

interface OnboardingDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: any; // This will be the onboarding_data JSONB
  companyName?: string;
}

// Helper function to convert image to base64
const getBase64FromImage = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas 2D context'));
          return;
        }
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        const dataURL = canvas.toDataURL('image/png');
        if (!dataURL || dataURL === 'data:,') {
          reject(new Error('Canvas toDataURL returned empty or invalid data.'));
          return;
        }
        resolve(dataURL);
      } catch (e: any) {
        reject(new Error(`Error during canvas operations: ${e.message}`))
      }
    };
    img.onerror = (errorEvent) => {
      // errorEvent might be an Event or string depending on browser, try to get more info
      let errorDetails = 'Unknown image loading error';
      if (typeof errorEvent === 'string') {
        errorDetails = errorEvent;
      } else if (errorEvent && errorEvent.target && (errorEvent.target as HTMLImageElement).src) {
        errorDetails = `Failed to load image from ${(errorEvent.target as HTMLImageElement).src}`;
      }      
      reject(new Error(errorDetails));
    };
    img.src = url;
  });
};

// Helper to format question keys into readable text
const formatQuestionKey = (key: string): string => {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
};

// Helper to format currency values
const formatCurrency = (value: number | string): string => {
  const numValue = typeof value === 'string' ? parseFloat(value.replace(/[£,\s]/g, '')) : value;
  if (isNaN(numValue)) return String(value);
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numValue);
};

// Helper to format answer values
const formatAnswer = (value: any, fieldKey?: string): string => {
  if (value === null || value === undefined) {
    return 'Not provided';
  }
  
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  
  // Handle currency fields
  if (fieldKey && (
    fieldKey.includes('revenue') || 
    fieldKey.includes('payment') || 
    fieldKey.includes('amount') ||
    fieldKey.includes('price') ||
    fieldKey.includes('cost')
  )) {
    // Try to parse as number
    const numValue = typeof value === 'string' ? parseFloat(value.replace(/[£,\s]/g, '')) : Number(value);
    if (!isNaN(numValue)) {
      return formatCurrency(numValue);
    }
  }
  
  // Handle percentage fields
  if (fieldKey && fieldKey.includes('percentage') || fieldKey?.includes('margin')) {
    const numValue = typeof value === 'string' ? parseFloat(value.replace(/[%,\s]/g, '')) : Number(value);
    if (!isNaN(numValue)) {
      return `${numValue}%`;
    }
  }
  
  if (Array.isArray(value)) {
    if (value.length === 0) return 'None provided';
    
    // Special handling for business owners
    if (fieldKey?.includes('business_owners') || fieldKey?.includes('owners')) {
      return value.map((item, index) => {
        if (typeof item === 'object' && item !== null) {
          const fullName = item.fullName || item.full_name || item.name || 'N/A';
          const role = item.role || '';
          return `${index + 1}. ${fullName}${role ? ` (${role})` : ''}`;
        }
        // If it's a string that looks like JSON, try to parse it
        if (typeof item === 'string' && item.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(item);
            const fullName = parsed.fullName || parsed.full_name || parsed.name || 'N/A';
            const role = parsed.role || '';
            return `${index + 1}. ${fullName}${role ? ` (${role})` : ''}`;
          } catch {
            return `${index + 1}. ${item}`;
          }
        }
        return `${index + 1}. ${item}`;
      }).join('\n');
    }
    
    return value.map((item, index) => {
      if (typeof item === 'object' && item !== null) {
        // Try to extract meaningful text from objects
        const text = item.text || item.value || item.name || item.title || JSON.stringify(item);
        return `${index + 1}. ${text}`;
      }
      // If it's a string that looks like JSON, try to parse it
      if (typeof item === 'string' && item.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(item);
          const fullName = parsed.fullName || parsed.full_name || parsed.name || 'N/A';
          const role = parsed.role || '';
          return `${index + 1}. ${fullName}${role ? ` (${role})` : ''}`;
        } catch {
          return `${index + 1}. ${item}`;
        }
      }
      return `${index + 1}. ${item}`;
    }).join('\n');
  }
  
  // Handle string values that might be JSON (for business owners stored as string)
  if (typeof value === 'string' && value.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        if (fieldKey?.includes('business_owners') || fieldKey?.includes('owners')) {
          return parsed.map((item, index) => {
            if (typeof item === 'object' && item !== null) {
              const fullName = item.fullName || item.full_name || item.name || 'N/A';
              const role = item.role || '';
              return `${index + 1}. ${fullName}${role ? ` (${role})` : ''}`;
            }
            return `${index + 1}. ${item}`;
          }).join('\n');
        }
      }
    } catch {
      // Not valid JSON, continue with normal string handling
    }
  }
  
  // Handle business owners stored as comma-separated string: "John Doe (CEO), Jane Smith (CTO)"
  if (fieldKey && (fieldKey.includes('business_owners') || fieldKey.includes('owners'))) {
    if (typeof value === 'string' && value.includes('(') && value.includes(')')) {
      const ownersList = value.split(',').map((item: string) => {
        const trimmed = item.trim();
        const match = trimmed.match(/^(.+?)\s*\((.+?)\)$/);
        if (match) {
          return { fullName: match[1].trim(), role: match[2].trim() };
        }
        return { fullName: trimmed, role: '' };
      });
      
      return ownersList.map((owner: any, index: number) => {
        return `${index + 1}. ${owner.fullName}${owner.role ? ` (${owner.role})` : ''}`;
      }).join('\n');
    }
  }
  
  if (typeof value === 'object' && value !== null) {
    // Special handling for business owner objects
    if (value.fullName || value.full_name || value.name) {
      const fullName = value.fullName || value.full_name || value.name;
      const role = value.role || '';
      return `${fullName}${role ? ` (${role})` : ''}`;
    }
    
    // For objects, try to extract meaningful information
    const entries = Object.entries(value);
    if (entries.length === 0) return 'Not provided';
    
    return entries.map(([key, val]) => {
      const formattedKey = formatQuestionKey(key);
      const formattedVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
      return `${formattedKey}: ${formattedVal}`;
    }).join('\n');
  }
  
  return String(value);
};

// Helper to flatten nested objects into question-answer pairs
const flattenData = (data: any, questionLabels: Record<string, string> = {}, prefix: string = ''): Array<{ question: string; answer: string; key: string }> => {
  const results: Array<{ question: string; answer: string; key: string }> = [];
  
  if (!data || typeof data !== 'object') {
    return results;
  }
  
  // Skip question_labels itself
  if (prefix === '' && data.question_labels) {
    // Process other fields but skip question_labels
    Object.entries(data).forEach(([key, value]) => {
      if (key === 'question_labels') return;
      
      const questionKey = key;
      // Use question_labels if available, otherwise format the key
      const questionText = questionLabels[questionKey] || formatQuestionKey(questionKey);
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Check if this object has simple key-value pairs or if it should be flattened further
        const entries = Object.entries(value);
        const hasNestedObjects = entries.some(([_, val]) => typeof val === 'object' && val !== null && !Array.isArray(val));
        
        if (hasNestedObjects && entries.length > 1) {
          // Flatten further
          results.push(...flattenData(value, questionLabels, questionKey));
        } else {
          // Treat as a single answer
          results.push({
            question: questionText,
            answer: formatAnswer(value, questionKey),
            key: questionKey
          });
        }
      } else {
        results.push({
          question: questionText,
          answer: formatAnswer(value, questionKey),
          key: questionKey
        });
      }
    });
  } else {
    Object.entries(data).forEach(([key, value]) => {
      const questionKey = prefix ? `${prefix} - ${key}` : key;
      // Use question_labels if available, otherwise format the key
      const questionText = questionLabels[questionKey] || formatQuestionKey(questionKey);
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Check if this object has simple key-value pairs or if it should be flattened further
        const entries = Object.entries(value);
        const hasNestedObjects = entries.some(([_, val]) => typeof val === 'object' && val !== null && !Array.isArray(val));
        
        if (hasNestedObjects && entries.length > 1) {
          // Flatten further
          results.push(...flattenData(value, questionLabels, questionKey));
        } else {
          // Treat as a single answer
          results.push({
            question: questionText,
            answer: formatAnswer(value, questionKey),
            key: questionKey
          });
        }
      } else {
        results.push({
          question: questionText,
          answer: formatAnswer(value, questionKey),
          key: questionKey
        });
      }
    });
  }
  
  return results;
};

const OnboardingDataModal: React.FC<OnboardingDataModalProps> = ({ isOpen, onClose, data, companyName }) => {
  if (!isOpen) return null;

  // Extract question_labels from data if available
  const questionLabels = data?.question_labels || {};
  const questionAnswers = data ? flattenData(data, questionLabels) : [];

  const downloadPdf = async () => {
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const headerHeight = 25;
      const footerHeight = 15;
      let yPosition = margin + headerHeight;
      
      let logoBase64: string | null = null;
      try {
        if (localLogo.src) {
          logoBase64 = await getBase64FromImage(localLogo.src);
        } else {
          throw new Error('Imported logo does not have a src property.');
        }
      } catch (error: any) {
        console.error('Could not process imported logo for PDF:', error.message);
        alert(`Failed to process imported logo for PDF: ${error.message}. Using text fallback.`)
      }
      
      const addHeaderFooter = (pageNum: number, totalPages: number) => {
        pdf.setFillColor(248, 250, 252); 
        pdf.rect(0, 0, pageWidth, headerHeight, 'F');
        
        if (logoBase64) {
          try {
            pdf.addImage(logoBase64, 'PNG', margin, 7, 30, 11); 
          } catch (error) {
            console.log('Error adding local logo to PDF:', error);
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(59, 130, 246);
            pdf.text('Trade Business School', margin, 15);
          }
        } else {
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(59, 130, 246);
          pdf.text('Trade Business School', margin, 15);
        }
        
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(31, 41, 55); 
        const headerText = companyName ? `${companyName}` : 'Onboarding Report';
        pdf.text(headerText, pageWidth - margin, 15, { align: 'right' });
        
        const footerY = pageHeight - footerHeight + 10; 
        pdf.setFillColor(248, 250, 252);
        pdf.rect(0, pageHeight - footerHeight, pageWidth, footerHeight, 'F');
        
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(107, 114, 128); 
        pdf.text(`Generated on: ${new Date().toLocaleDateString()}`, margin, footerY);
        pdf.text(`Page ${pageNum} / ${totalPages}`, pageWidth - margin, footerY, { align: 'right' });
        if (companyName) {
            pdf.text(`Company: ${companyName}`, pageWidth / 2, footerY, { align: 'center' });
        }
      };

      let totalPages = 1;
      let tempY = margin + headerHeight + 5; 
      const pageContentHeight = pageHeight - headerHeight - footerHeight - (margin * 2);
      
      const estimateHeight = (text: string, fontSize: number, maxWidth: number, lineHeightFactor: number = 1.2): number => {
        pdf.setFontSize(fontSize);
        const lines = pdf.splitTextToSize(text, maxWidth);
        return lines.length * fontSize * lineHeightFactor * 0.352778; 
      };

      questionAnswers.forEach((qa, index) => {
        const questionText = `${index + 1}. ${qa.question}`;
        const textMaxWidth = pageWidth - (margin * 2) - 10;
        const qHeight = estimateHeight(questionText, 11, textMaxWidth);
        const aHeight = estimateHeight(qa.answer, 10, textMaxWidth);
        const blockPadding = 4;
        const spaceBetweenQA = 2;
        const spaceAfterBlock = 3;
        const itemTotalHeight = (blockPadding * 2) + qHeight + spaceBetweenQA + aHeight + spaceAfterBlock;

        if (tempY + itemTotalHeight > margin + headerHeight + pageContentHeight) {
          totalPages++;
          tempY = margin + headerHeight + 5;
        }
        tempY += itemTotalHeight;
      });

      let currentPage = 1;
      addHeaderFooter(currentPage, totalPages);
      
      yPosition = margin + headerHeight + 5; 

      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(31, 41, 55);
    

      questionAnswers.forEach((qa, index) => {
        const questionText = `${index + 1}. ${qa.question}`;
        const textMaxWidth = pageWidth - (margin * 2) - (4 * 2);
        const qHeight = estimateHeight(questionText, 11, textMaxWidth);
        const aHeight = estimateHeight(qa.answer, 10, textMaxWidth);
        const blockPadding = 4;
        const spaceBetweenQA = 2;
        const spaceAfterBlock = 3;
        const itemTotalHeight = (blockPadding * 2) + qHeight + spaceBetweenQA + aHeight;

        if (yPosition + itemTotalHeight + spaceAfterBlock > margin + headerHeight + pageContentHeight) {
          pdf.addPage();
          currentPage++;
          addHeaderFooter(currentPage, totalPages);
          yPosition = margin + headerHeight + 5; 
        }

        pdf.setDrawColor(220, 220, 220);
        pdf.setFillColor(249, 250, 251);
        pdf.roundedRect(margin, yPosition, pageWidth - (margin * 2), itemTotalHeight, 3, 3, 'FD');

        let currentY = yPosition + blockPadding;

        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(49, 46, 229);
        const questionLines = pdf.splitTextToSize(questionText, pageWidth - (margin * 2) - (blockPadding * 2));
        questionLines.forEach((line: string) => {
          pdf.text(line, margin + blockPadding, currentY + 3);
          currentY += 5;
        });

        currentY += spaceBetweenQA;

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(55, 65, 81);
        const answerLines = pdf.splitTextToSize(qa.answer, pageWidth - (margin * 2) - (blockPadding * 2));
        answerLines.forEach((line: string) => {
          pdf.text(line, margin + blockPadding, currentY + 3);
          currentY += 4.5;
        });
        
        yPosition += itemTotalHeight + spaceAfterBlock;
      });

      const fileName = `${companyName ? companyName.replace(/\s+/g, '_') + '_' : ''}onboarding_data.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF. Please check the console for errors.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-all duration-300">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col m-4 border border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Company Onboarding Details</h2>
              {companyName && (
                <p className="text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <Building className="w-3 h-3" />
                    {companyName}
                  </span>
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {questionAnswers.length > 0 ? (
            <div className="space-y-4">
              {questionAnswers.map((qa, index) => (
                <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
                  <div className="text-sm font-medium text-gray-700">
                    {qa.question}
                  </div>
                  <div className="text-sm text-gray-600 pl-0">
                    <p className="whitespace-pre-wrap">{qa.answer}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 bg-gray-100 rounded-full mb-4">
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Available</h3>
              <p className="text-gray-600 max-w-sm">
                No onboarding data has been submitted for this company yet.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-100 bg-gray-50 rounded-b-xl">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Calendar className="w-4 h-4" />
            <span>Last updated: {new Date().toLocaleDateString()}</span>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
            >
              Close
            </button>
            {questionAnswers.length > 0 && (
              <button
                onClick={downloadPdf}
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingDataModal; 