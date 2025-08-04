import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@/utils/supabase/server';
import { getTeamMemberIds } from '@/utils/supabase/teams';

// Initialize Gemini AI with error handling
let genAI: GoogleGenerativeAI;
try {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('NEXT_PUBLIC_GEMINI_API_KEY environment variable is not set');
  }
  genAI = new GoogleGenerativeAI(apiKey);
} catch (error) {
  console.error('Error initializing Gemini AI:', error);
}

export async function POST(request: NextRequest) {
  try {
    let supabase;
    try {
      supabase = await createClient();
    } catch (clientError) {
      console.error('Error creating Supabase client:', clientError);
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 500 }
      );
    }

    // Add cache-busting headers
    const headers = {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { naturalLanguageInput, documentType } = body;

    // Validation
    if (!naturalLanguageInput || typeof naturalLanguageInput !== 'string' || naturalLanguageInput.trim().length === 0) {
      return NextResponse.json(
        { error: 'Natural language input is required and cannot be empty' },
        { status: 400 }
      );
    }

    const validDocumentTypes = ['all', 'playbooks', 'business_plans'];
    const selectedDocType = documentType || 'playbooks'; // Default to playbooks for backward compatibility
    
    if (!validDocumentTypes.includes(selectedDocType)) {
      return NextResponse.json(
        { error: 'Invalid document type specified' },
        { status: 400 }
      );
    }

    if (naturalLanguageInput.trim().length > 1000) {
      return NextResponse.json(
        { error: 'Natural language input is too long (maximum 1000 characters)' },
        { status: 400 }
      );
    }

    // Check for potential XSS or malicious input
    const suspiciousPatterns = [/<script|javascript:|data:|vbscript:|on\w+=/i];
    if (suspiciousPatterns.some(pattern => pattern.test(naturalLanguageInput))) {
      return NextResponse.json(
        { error: 'Invalid input detected' },
        { status: 400 }
      );
    }

    // Only search the logged-in user's documents
    const userIds = [user.id];
    console.log(`Searching ${selectedDocType} for user ID:`, user.id);
    
    let documents: any[] = [];
    let tableName = '';
    let contentField = '';
    let nameField = '';
    
    // Determine which table and fields to use based on document type
    if (selectedDocType === 'business_plans' || selectedDocType === 'all') {
      // Fetch business plans from battle_plan table
      const { data: businessPlans, error: businessPlansError } = await supabase
        .from('battle_plan')
        .select('id, business_plan_content, user_id, updated_at')
        .eq('user_id', user.id)
        .not('business_plan_content', 'is', null)
        .not('business_plan_content', 'eq', '')
        .order('updated_at', { ascending: false });

      if (businessPlansError) {
        console.error('Error fetching business plans:', businessPlansError);
      } else if (businessPlans && businessPlans.length > 0) {
        // Transform business plans to match the expected format
        const transformedBusinessPlans = businessPlans.map((plan: any) => ({
          id: plan.id,
          playbookname: 'Business Plan', // Use a consistent name for business plans
          content: plan.business_plan_content,
          user_id: plan.user_id,
          updated_at: plan.updated_at,
          documentType: 'business_plan'
        }));
        documents.push(...transformedBusinessPlans);
      }
    }
    
    if (selectedDocType === 'playbooks' || selectedDocType === 'all') {
      // Fetch playbooks from playbooks table
      const { data: playbooks, error: playbooksError } = await supabase
        .from('playbooks')
        .select('id, playbookname, content, user_id, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (playbooksError) {
        console.error('Error fetching playbooks:', playbooksError);
      } else if (playbooks && playbooks.length > 0) {
        // Transform playbooks to match the expected format
        const transformedPlaybooks = playbooks.map((playbook: any) => ({
          ...playbook,
          documentType: 'playbook'
        }));
        documents.push(...transformedPlaybooks);
      }
    }

    if (documents.length === 0) {
      return NextResponse.json(
        { error: `No ${selectedDocType} with content found` },
        { status: 404 }
      );
    }

    console.log(`[${new Date().toISOString()}] Found ${documents.length} documents to search:`, documents.map(doc => ({
      id: doc.id,
      name: doc.playbookname,
      contentLength: (doc.content || '').length,
      lastUpdated: doc.updated_at,
      documentType: doc.documentType
    })));

    // Use Gemini to parse the natural language input with error handling
    if (!genAI) {
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 500 }
      );
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    // Create content summary for Gemini
    const documentSummaries = documents.map((doc: any) => `
${doc.documentType === 'business_plan' ? 'Business Plan' : 'Playbook'}: "${doc.playbookname}" (ID: ${doc.id})
Content preview: ${(doc.content || '').substring(0, 500)}...
`).join('\n');

    const parsePrompt = `
You are a content replacement assistant. Analyze a natural language instruction and extract the exact "find" and "replace" text that should be applied across ALL documents.

Available documents:
${documentSummaries}

Natural language instruction:
${naturalLanguageInput}

Please analyze the instruction and return a JSON response with the following structure:
{
  "find": "exact text to find in ALL documents",
  "replace": "new text to replace it with",
  "applyToAll": true
}

CRITICAL RULES:
1. Extract the EXACT text mentioned in the instruction - do NOT add letters, words, or change spelling
2. If user says "Trade Gang", use exactly "Trade Gang" - do NOT change to "Trades Gang" or add 's'
3. Be extremely precise with capitalization and spacing
4. This replacement should apply to ALL documents that contain the text
5. Respond ONLY with valid JSON, no additional text

Examples:
- "Replace 'old process' with 'new streamlined process'" → {"find": "old process", "replace": "new streamlined process", "applyToAll": true}
- "We have rebranded Trade Gang to Leads Hub. Change all documents" → {"find": "Trade Gang", "replace": "Leads Hub", "applyToAll": true}
- "Change the deadline from March 15th to April 1st" → {"find": "March 15th", "replace": "April 1st", "applyToAll": true}
`;

    let result, response, text;
    try {
      result = await model.generateContent(parsePrompt);
      response = result.response;
      text = response.text();
    } catch (geminiError) {
      console.error('Gemini API error:', geminiError);
      return NextResponse.json(
        { error: 'AI service temporarily unavailable' },
        { status: 503 }
      );
    }
    
    let parsedResponse;
    try {
      // Clean the response text by removing any markdown formatting
      const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
      parsedResponse = JSON.parse(cleanText);
    } catch (parseError) {
      console.error('JSON parse error:', parseError, 'Raw text:', text);
      return NextResponse.json(
        { 
          error: 'Failed to understand the replacement instruction',
          suggestion: 'Please be more specific about what text to find and what to replace it with'
        },
        { status: 400 }
      );
    }

    // Validate the parsed response
    if (!parsedResponse.find || !parsedResponse.replace) {
      return NextResponse.json(
        { 
          error: 'Could not determine what to find and replace',
          suggestion: 'Please provide a clearer instruction like "Replace X with Y"'
        },
        { status: 400 }
      );
    }

    if (typeof parsedResponse.find !== 'string' || typeof parsedResponse.replace !== 'string') {
      return NextResponse.json(
        { error: 'Invalid replacement instruction format' },
        { status: 400 }
      );
    }

    // Process all documents to find and replace text
    const findText = parsedResponse.find.trim();
    const replaceText = parsedResponse.replace.trim();
    
    console.log(`Looking for text: "${findText}" to replace with: "${replaceText}"`);
    
    // Generate intelligent variations of the search text
    const generateTextVariations = (text: string): string[] => {
      const variations = [text]; // Always include original
      
      // List of words that shouldn't have 'es' added
      const noEsWords = ['gang', 'king', 'ring', 'thing', 'wing', 'sing', 'bring', 'string'];
      
      // Add plural/singular variations for multi-word phrases
      const words = text.split(' ');
      if (words.length >= 2) {
        // For multi-word phrases, try adding/removing 's' from the last word
        const lastWord = words[words.length - 1].toLowerCase();
        const originalLastWord = words[words.length - 1];
        
        if (originalLastWord.endsWith('s') && originalLastWord.length > 3 && !originalLastWord.endsWith('ss')) {
          // Remove 's' from last word (plural to singular)
          const singularWords = [...words];
          singularWords[singularWords.length - 1] = originalLastWord.slice(0, -1);
          variations.push(singularWords.join(' '));
        } else {
          // Add 's' to last word (singular to plural) - only if it doesn't already end in 's'
          if (!originalLastWord.endsWith('s')) {
            const pluralWords = [...words];
            pluralWords[pluralWords.length - 1] = originalLastWord + 's';
            variations.push(pluralWords.join(' '));
          }
        }
        
        // For "Trade Gang" specifically, also try "Trades Gang"
        if (words.length === 2) {
          const firstWord = words[0];
          const secondWord = words[1];
          
          // Try making first word plural/singular
          if (firstWord.endsWith('s') && firstWord.length > 3) {
            variations.push(`${firstWord.slice(0, -1)} ${secondWord}`);
          } else if (!firstWord.endsWith('s')) {
            variations.push(`${firstWord}s ${secondWord}`);
          }
        }
      } else {
        // For single words, handle plural/singular
        if (text.endsWith('s') && text.length > 3 && !text.endsWith('ss')) {
          variations.push(text.slice(0, -1)); // Remove 's' for singular
        } else if (!text.endsWith('s')) {
          variations.push(text + 's'); // Add 's' for plural
        }
      }
      
      // Add capitalization variations for all variations found so far
      const currentVariations = [...variations];
      for (const variation of currentVariations) {
        variations.push(variation.toLowerCase());
        variations.push(variation.toUpperCase());
        variations.push(variation.charAt(0).toUpperCase() + variation.slice(1).toLowerCase());
      }
      
      // Remove duplicates and empty strings
      return Array.from(new Set(variations)).filter(v => v.length > 0);
    };
    
    const searchVariations = generateTextVariations(findText);
    console.log(`Search variations generated:`, searchVariations);
    
    const updatedDocuments: any[] = [];
    const documentsWithMatches: any[] = [];
    const documentsSearched: any[] = [];
    let totalChanges = 0;

    // Check each document for the text
    for (const document of documents) {
      const currentContent = document.content || '';
      
      // Check for any variation of the search text
      const foundVariations: string[] = [];
      let hasAnyMatch = false;
      
      for (const variation of searchVariations) {
        if (currentContent.includes(variation)) {
          foundVariations.push(variation);
          hasAnyMatch = true;
        }
      }
      
      // Track all documents searched for debugging
      documentsSearched.push({
        id: document.id,
        name: document.playbookname,
        contentLength: currentContent.length,
        hasContent: currentContent.length > 0,
        containsText: hasAnyMatch,
        foundVariations: foundVariations,
        userId: document.user_id,
        documentType: document.documentType
      });
      
      console.log(`Searching ${document.documentType} "${document.playbookname}" (${currentContent.length} chars) - Found variations: [${foundVariations.join(', ')}]`);
      
      if (hasAnyMatch) {
        documentsWithMatches.push(document);
        
        // Perform the replacement with proper escaping for ALL variations found
        let updatedContent = currentContent;
        let totalMatchCount = 0;
        
        try {
          // Replace each found variation
          for (const variation of foundVariations) {
            const escapedVariation = variation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escapedVariation, 'g');
            const matches = updatedContent.match(regex) || [];
            totalMatchCount += matches.length;
            updatedContent = updatedContent.replace(regex, replaceText);
            
            console.log(`Replaced ${matches.length} instances of "${variation}" with "${replaceText}" in ${document.playbookname}`);
          }
          
          totalChanges += totalMatchCount;
          
          // Update the document in the database based on document type
          let updateResult, updateError;
          
          if (document.documentType === 'business_plan') {
            // Update business plan in battle_plan table
            const { data: result, error: error } = await supabase
              .from('battle_plan')
              .update({ 
                business_plan_content: updatedContent,
                updated_at: new Date().toISOString()
              })
              .eq('id', document.id)
              .eq('user_id', user.id)
              .select('id')
              .single();
            updateResult = result;
            updateError = error;
          } else {
            // Update playbook in playbooks table
            const { data: result, error: error } = await supabase
              .from('playbooks')
              .update({ 
                content: updatedContent,
                updated_at: new Date().toISOString()
              })
              .eq('id', document.id)
              .eq('user_id', user.id)
              .select('id, playbookname')
              .single();
            updateResult = result;
            updateError = error;
          }

          if (updateError) {
            console.error(`Database update error for ${document.documentType} ${document.id}:`, updateError);
            continue; // Skip this document but continue with others
          }

          if (updateResult) {
            updatedDocuments.push({
              id: updateResult.id,
              name: document.playbookname,
              changesCount: totalMatchCount,
              variationsReplaced: foundVariations,
              documentType: document.documentType
            });
          }
        } catch (regexError) {
          console.error('Regex error:', regexError);
          // Fallback to simple string replacement for all variations
          updatedContent = currentContent;
          let fallbackCount = 0;
          
          for (const variation of foundVariations) {
            const countBefore = updatedContent.split(variation).length - 1;
            updatedContent = updatedContent.split(variation).join(replaceText);
            fallbackCount += countBefore;
          }
          
          totalChanges += fallbackCount;
          
          // Update with fallback method based on document type
          let updateResult, updateError;
          
          if (document.documentType === 'business_plan') {
            const { data: result, error: error } = await supabase
              .from('battle_plan')
              .update({ 
                business_plan_content: updatedContent,
                updated_at: new Date().toISOString()
              })
              .eq('id', document.id)
              .eq('user_id', user.id)
              .select('id')
              .single();
            updateResult = result;
            updateError = error;
          } else {
            const { data: result, error: error } = await supabase
              .from('playbooks')
              .update({ 
                content: updatedContent,
                updated_at: new Date().toISOString()
              })
              .eq('id', document.id)
              .eq('user_id', user.id)
              .select('id, playbookname')
              .single();
            updateResult = result;
            updateError = error;
          }

          if (!updateError && updateResult) {
            updatedDocuments.push({
              id: updateResult.id,
              name: document.playbookname,
              changesCount: fallbackCount,
              variationsReplaced: foundVariations,
              documentType: document.documentType
            });
          }
        }
      }
    }

    // Check if any matches were found
    if (documentsWithMatches.length === 0) {
      // Try case-insensitive search as fallback with all variations
      const caseInsensitiveMatches = documents.filter(doc => {
        const content = (doc.content || '').toLowerCase();
        return searchVariations.some(variation => content.includes(variation.toLowerCase()));
      });
      
      if (caseInsensitiveMatches.length > 0) {
        return NextResponse.json(
          { 
            error: 'Text found with different case',
            suggestion: `Found similar text with different case in ${caseInsensitiveMatches.length} document(s). Searched variations: [${searchVariations.join(', ')}]`,
            debug: {
              totalDocumentsSearched: documentsSearched.length,
              documentsSearched: documentsSearched,
              searchTerm: findText,
              searchVariations: searchVariations,
              replacementTerm: replaceText,
              timestamp: new Date().toISOString()
            }
          },
          { status: 404, headers }
        );
      }

      return NextResponse.json(
        { 
          error: 'Text to find not found in content',
          suggestion: `Could not find "${findText}" or its variations in any document content. Searched for: [${searchVariations.join(', ')}]`,
          debug: {
            totalDocumentsSearched: documentsSearched.length,
            documentsSearched: documentsSearched,
            searchTerm: findText,
            searchVariations: searchVariations,
            replacementTerm: replaceText,
            timestamp: new Date().toISOString()
          }
        },
        { status: 404, headers }
      );
    }

    // Check if any updates actually succeeded
    if (updatedDocuments.length === 0) {
      return NextResponse.json(
        { error: 'Failed to update any documents' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        originalText: findText,
        replacementText: replaceText,
        totalChanges,
        documentsUpdated: updatedDocuments.length,
        documentsFound: documentsWithMatches.length,
        updatedDocuments,
        message: `Successfully replaced "${findText}" with "${replaceText}" in ${updatedDocuments.length} document(s) with ${totalChanges} total changes`
      },
      debug: {
        totalDocumentsSearched: documentsSearched.length,
        documentsSearched: documentsSearched,
        searchTerm: findText,
        searchVariations: searchVariations,
        replacementTerm: replaceText,
        timestamp: new Date().toISOString()
      }
    }, { headers });

  } catch (error) {
    console.error('Error updating document content:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}