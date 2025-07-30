"use client";

import { useState } from 'react';
import ReusableTiptapEditor from '@/components/reusable-tiptap-editor';

export default function TestDocxExportPage() {
  const [content, setContent] = useState(`
    <h1>Sample Document for DOCX Export</h1>
    <p>This is a <strong>sample document</strong> to test the DOCX export functionality.</p>
    <h2>Features</h2>
    <ul>
      <li>Headings (H1, H2, H3)</li>
      <li><em>Italic text</em></li>
      <li><strong>Bold text</strong></li>
      <li><u>Underlined text</u></li>
      <li><s>Strikethrough text</s></li>
      <li><code>Inline code</code></li>
    </ul>
    <h3>Lists</h3>
    <ol>
      <li>Numbered list item 1</li>
      <li>Numbered list item 2</li>
      <li>Numbered list item 3</li>
    </ol>
    <blockquote>
      This is a blockquote to test how it appears in the exported DOCX file.
    </blockquote>
    <h2>Table Example</h2>
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Age</th>
          <th>City</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>John Doe</td>
          <td>30</td>
          <td>New York</td>
        </tr>
        <tr>
          <td>Jane Smith</td>
          <td>25</td>
          <td>Los Angeles</td>
        </tr>
      </tbody>
    </table>
    <hr>
    <p>This document demonstrates various formatting options that should be preserved when exporting to DOCX format.</p>
  `);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">DOCX Export Test</h1>
          <p className="text-gray-600">
            This page demonstrates the DOCX export functionality of the TipTap editor. 
            Click the "DOCX" button in the toolbar to export the content.
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <ReusableTiptapEditor
            content={content}
            onChange={setContent}
            showExportButton={true}
            placeholder="Start writing your document..."
          />
        </div>
        
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">Instructions:</h3>
          <ul className="text-blue-800 text-sm space-y-1">
            <li>• Edit the content in the editor above</li>
            <li>• Use the toolbar to format your text</li>
            <li>• Click the "DOCX" button in the toolbar to export</li>
            <li>• The exported file will be named based on the first heading</li>
            <li>• All formatting (bold, italic, lists, tables, etc.) will be preserved</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 