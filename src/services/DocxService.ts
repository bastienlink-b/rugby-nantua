import mammoth from 'mammoth';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { PDFDocument } from 'pdf-lib';

/**
 * Extracts text from a Word document
 * @param buffer ArrayBuffer containing the Word document
 * @returns Extracted text
 */
export const extractTextFromDocx = async (buffer: ArrayBuffer): Promise<string> => {
  try {
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return result.value;
  } catch (error) {
    console.error('Error extracting text from Word document:', error);
    throw error;
  }
};

/**
 * Converts a Word document to PDF
 * @param buffer ArrayBuffer containing the Word document
 * @returns PDF as ArrayBuffer
 */
export const convertDocxToPdf = async (buffer: ArrayBuffer): Promise<ArrayBuffer> => {
  try {
    // First extract text from Word document
    const text = await extractTextFromDocx(buffer);
    
    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4 size
    const { width, height } = page.getSize();
    
    // Add text to PDF
    page.drawText(text, {
      x: 50,
      y: height - 50,
      size: 12,
      maxWidth: width - 100,
    });
    
    // Save PDF
    return await pdfDoc.save();
  } catch (error) {
    console.error('Error converting Word document to PDF:', error);
    throw error;
  }
};

/**
 * Creates a new Word document from template
 * @param template Template data
 * @param data Data to fill in template
 * @returns Word document as ArrayBuffer
 */
export const createDocxFromTemplate = async (
  template: ArrayBuffer,
  data: Record<string, any>
): Promise<ArrayBuffer> => {
  try {
    // Create a new Word document
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: "Generated from template",
                bold: true,
              }),
            ],
          }),
          // Add more paragraphs based on template and data
        ],
      }],
    });

    // Generate document
    return await Packer.toBuffer(doc);
  } catch (error) {
    console.error('Error creating Word document from template:', error);
    throw error;
  }
};