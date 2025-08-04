"use client";

import { useState } from "react";
import { Loader2, MessageSquare, CheckCircle, AlertCircle, RefreshCw, BookOpen, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CustomDropdown } from "@/components/ui/custom-dropdown";

type UpdateResult = {
  success: boolean;
  playbookName?: string;
  originalText: string;
  replacementText: string;
  message: string;
  totalChanges?: number;
  documentsUpdated?: number;
  documentsFound?: number;
  updatedDocuments?: Array<{
    id: string;
    name: string;
    changesCount: number;
    documentType?: string;
  }>;
  error?: string;
  suggestion?: string;
  debug?: {
    totalDocumentsSearched: number;
    documentsSearched: Array<{
      id: string;
      name: string;
      contentLength: number;
      hasContent: boolean;
      containsText: boolean;
      foundVariations?: string[];
      userId: string;
      documentType?: string;
    }>;
    searchTerm: string;
    searchVariations?: string[];
    replacementTerm: string;
  };
};

export default function UpdateContentPage() {
  const [naturalLanguageInput, setNaturalLanguageInput] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [updateResult, setUpdateResult] = useState<UpdateResult | null>(null);
  const [selectedDocumentType, setSelectedDocumentType] = useState<string>("all");

  const documentTypes = [
    { value: "all", label: "All Documents" },
    { value: "playbooks", label: "Playbooks" },
    { value: "business_plans", label: "Business Plans" }
  ];


  const handleUpdateContent = async () => {
    if (!naturalLanguageInput.trim()) {
      return;
    }

    try {
      setLoading(true);
      setUpdateResult(null);

      const response = await fetch('/api/playbook/update-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify({
          naturalLanguageInput: naturalLanguageInput.trim(),
          documentType: selectedDocumentType,
          timestamp: new Date().toISOString() // Cache busting
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setUpdateResult({
          success: true,
          playbookName: result.data.playbookName,
          originalText: result.data.originalText,
          replacementText: result.data.replacementText,
          message: result.data.message,
          totalChanges: result.data.totalChanges,
          documentsUpdated: result.data.documentsUpdated,
          documentsFound: result.data.documentsFound,
          updatedDocuments: result.data.updatedDocuments
        });
        setNaturalLanguageInput("");
      } else {
        setUpdateResult({
          success: false,
          playbookName: "",
          originalText: "",
          replacementText: "",
          message: "",
          error: result.error || "Failed to update content",
          suggestion: result.suggestion
        });
      }
    } catch (error) {
      console.error("Error updating content:", error);
      setUpdateResult({
        success: false,
        playbookName: "",
        originalText: "",
        replacementText: "",
        message: "",
        error: "An unexpected error occurred"
      });
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Global Find & Replace Tool:</h1>
        <p className="text-gray-600">
        This feature performs global find and replace operations across ALL documents. It will replace the specified text everywhere it appears in your selected document types. This is not a document editor - please visit specific pages for detailed editing. Please review your changes after the update to ensure accuracy.
        </p>

        <p className="text-gray-500 text-sm pt-3">Only supports playbooks and business plans. Select the document type you want to update.</p>
      </div>

 

      <div className="grid gap-6">

        {/* Natural Language Input */}
        <Card>
          <CardContent>
            <div className="space-y-4">
              <div className="pt-5">
                <Label htmlFor="document-type">Document Type</Label>
                <CustomDropdown
                  options={documentTypes}
                  value={selectedDocumentType}
                  onChange={setSelectedDocumentType}
                  placeholder="Select document type"
                />
              </div>
              
              <div>
                <div className="flex justify-between items-center pb-2">
                  <Label htmlFor="natural-input">What would you like to change?</Label>
                  <span className={`text-xs ${naturalLanguageInput.length > 1000 ? 'text-red-500' : 'text-gray-500'}`}>
                    {naturalLanguageInput.length}/1000
                  </span>
                </div>
                <Textarea
                  id="natural-input"
                  placeholder="Example: Replace 'old company name' with 'new company name'"
                  value={naturalLanguageInput}
                  onChange={(e) => setNaturalLanguageInput(e.target.value)}
                  className={`min-h-[100px] mt-2 ${naturalLanguageInput.length > 1000 ? 'border-red-500' : ''}`}
                  maxLength={1000}
                />
                {naturalLanguageInput.length > 1000 && (
                  <p className="text-xs text-red-500 mt-1">
                    Input is too long. Please keep it under 1000 characters.
                  </p>
                )}
              </div>

              <Button
                onClick={handleUpdateContent}
                disabled={loading || !naturalLanguageInput.trim() || naturalLanguageInput.length > 1000}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing Update...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Update Content
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {updateResult && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {updateResult.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600" />
                )}
                Update Result
              </CardTitle>
            </CardHeader>
            <CardContent>
              {updateResult.success ? (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    <div className="space-y-3">
                      <div className="font-medium">{updateResult.message}</div>
                      <div className="text-sm space-y-2">
                        <div><strong>Original text:</strong> "{updateResult.originalText}"</div>
                        <div><strong>Replaced with:</strong> "{updateResult.replacementText}"</div>
                        {updateResult.totalChanges && (
                          <div><strong>Total changes made:</strong> {updateResult.totalChanges}</div>
                        )}
                        {updateResult.updatedDocuments && updateResult.updatedDocuments.length > 0 && (
                          <div>
                            <strong>Updated documents:</strong>
                            <ul className="mt-1 ml-4 space-y-1">
                              {updateResult.updatedDocuments.map((document) => (
                                <li key={document.id} className="text-xs">
                                  • {document.name} ({document.changesCount} change{document.changesCount !== 1 ? 's' : ''})
                                  {document.documentType && (
                                    <span className="text-gray-500 ml-1">({document.documentType === 'business_plan' ? 'Business Plan' : 'Playbook'})</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    <div className="space-y-2">
                      <div className="font-medium">Update Failed</div>
                      <div className="text-sm">
                        <div>{updateResult.error}</div>
                        {updateResult.suggestion && (
                          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                            <strong>Suggestion:</strong> {updateResult.suggestion}
                          </div>
                        )}
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Debug Information */}
        {updateResult?.debug && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <MessageSquare className="h-4 w-4" />
                Debug Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-sm">
                  <div><strong>Search Term:</strong> "{updateResult.debug.searchTerm}"</div>
                  {updateResult.debug.searchVariations && (
                    <div><strong>Search Variations:</strong> [{updateResult.debug.searchVariations.join(', ')}]</div>
                  )}
                  <div><strong>Replacement Term:</strong> "{updateResult.debug.replacementTerm}"</div>
                  <div><strong>Total Documents Searched:</strong> {updateResult.debug.totalDocumentsSearched}</div>
                </div>
                
                <div>
                  <strong className="text-sm">Documents Searched:</strong>
                  <div className="mt-2 max-h-60 overflow-y-auto border rounded p-3 bg-gray-50">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-1">Document Name</th>
                          <th className="text-left py-1">Type</th>
                          <th className="text-left py-1">Content Length</th>
                          <th className="text-left py-1">Has Content</th>
                          <th className="text-left py-1">Found Variations</th>
                          <th className="text-left py-1">User ID</th>
                        </tr>
                      </thead>
                      <tbody>
                        {updateResult.debug.documentsSearched.map((document) => (
                          <tr key={document.id} className="border-b last:border-b-0">
                            <td className="py-1 font-medium">{document.name}</td>
                            <td className="py-1">
                              {document.documentType === 'business_plan' ? 'Business Plan' : 'Playbook'}
                            </td>
                            <td className="py-1">{document.contentLength}</td>
                            <td className="py-1">
                              <span className={document.hasContent ? 'text-green-600' : 'text-red-600'}>
                                {document.hasContent ? 'Yes' : 'No'}
                              </span>
                            </td>
                            <td className="py-1">
                              {document.foundVariations && document.foundVariations.length > 0 ? (
                                <span className="text-green-600 font-bold text-xs">
                                  [{document.foundVariations.join(', ')}]
                                </span>
                              ) : (
                                <span className="text-gray-500">None</span>
                              )}
                            </td>
                            <td className="py-1 font-mono text-xs">{document.userId}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}