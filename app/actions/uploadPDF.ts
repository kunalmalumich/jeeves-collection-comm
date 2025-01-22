'use server'

import { createClient } from '@supabase/supabase-js'
import { env } from '../config/env'
import { OpenAIApi, Configuration } from 'openai-edge'
import { GoogleGenerativeAI } from "@google/generative-ai"

// Ensure we're using the correct environment variables
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const configuration = new Configuration({
  apiKey: env.OPENAI_API_KEY,
})
const openai = new OpenAIApi(configuration)

export async function uploadPDF(formData: FormData) {
  const file = formData.get('file') as File
  const orgId = formData.get('orgId') as string
  const phoneNumber = formData.get('phoneNumber') as string

  if (!file || !orgId || !phoneNumber) {
    throw new Error('Missing required fields')
  }

  try {
    console.log('Starting PDF upload process...')
    console.log('Supabase URL:', env.NEXT_PUBLIC_SUPABASE_URL) // Log Supabase URL for debugging

    // Upload file to Supabase Storage with upsert option
    console.log('Uploading file to Supabase Storage...')
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('credit-card-statements')
      .upload(`${orgId}/${file.name}`, file, {
        upsert: true
      })

    if (uploadError) {
      console.error('Error uploading file to Supabase Storage:', uploadError)
      throw uploadError
    }

    // Get public URL of the uploaded file
    console.log('Getting public URL of the uploaded file...')
    const { data: urlData } = supabase.storage
      .from('credit-card-statements')
      .getPublicUrl(`${orgId}/${file.name}`)

    const publicUrl = urlData.publicUrl

    // Parse PDF using Google Gemini
    console.log('Parsing PDF using Google Gemini...')
    const parsedContent = await parsePDFWithGemini(file)

    // Split text into chunks
    console.log('Splitting text into chunks...')
    const chunks = splitTextIntoChunks(parsedContent, 1000, 200)

    // Delete existing entries for this file
    console.log('Deleting existing entries for this file...')
    const { error: deleteError } = await supabase
      .from('credit_card_statements')
      .delete()
      .match({ business_id: orgId, file_path: `${orgId}/${file.name}` })

    if (deleteError) {
      console.error('Error deleting existing entries:', deleteError)
      throw deleteError
    }

    // Create embeddings and store chunks in Supabase
    console.log('Creating embeddings and storing chunks...')
    for (const chunk of chunks) {
      const embedding = await createEmbedding(chunk)

      const { error: insertError } = await supabase
        .from('credit_card_statements')
        .insert({
          business_id: orgId,
          phone_number: phoneNumber,
          content: chunk,
          embedding,
          file_path: `${orgId}/${file.name}`,
          public_url: publicUrl,
        })

      if (insertError) {
        console.error('Error inserting chunk:', insertError)
        throw insertError
      }
    }

    console.log('PDF upload process completed successfully')
    return { message: 'PDF uploaded and processed successfully' }
  } catch (error) {
    console.error('Error processing PDF:', error)
    if (error instanceof Error) {
      throw new Error(`PDF processing failed: ${error.message}`)
    } else {
      throw new Error('PDF processing failed: Unknown error')
    }
  }
}

async function parsePDFWithGemini(file: File): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  // Initialize Gemini AI
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  // Convert file to base64
  const bytes = await file.arrayBuffer();
  const base64Data = Buffer.from(bytes).toString('base64');

  // Generate content using Gemini with a specific prompt for credit card statements
  const result = await model.generateContent([
    {
      inlineData: {
        data: base64Data,
        mimeType: "application/pdf",
      },
    },
    `Analyze this credit card statement PDF in detail. Focus on the following sections:
Summary: Provide a brief overview including statement period, account number (last 4 digits), and total amount due.
Transactions:
List ALL transactions with their dates, descriptions, and amounts. Do not miss any row.
Do not summarize or provide examples. Every single transaction must be included, regardless of the volume.
If there are many transactions, continue listing them all. Do not stop or summarize due to length.
Categorize each transaction (e.g., dining, travel, groceries)
Highlight any unusual or high-value transactions, but do not omit any other transactions when doing so.
Balance Details:
Provide a breakdown of the current balance, including previous balance, payments, new charges, fees, and interest if applicable
Include credit limit, available credit, and calculate the credit utilization percentage
Payment Instructions:
First, determine if the business address on the statement includes "Brazil", "United States", "Mexico", or "Colombia".
    - If the business address includes "Brazil", then focus on extracting the following payment details: PIX details, including the Chave PIX and the 'Copia E Cola Pix Payment' string. The 'Copia E Cola Pix Payment' string must be extracted as a single line with no line breaks, spaces, or any extra characters; provide it exactly as it appears with no modifications, extract also: TED: Razão Social (Legal Name), Agência (Branch), Banco (Bank Name), Conta (Deposit Account), CNPJ (Tax Id Number), Tipo da conta, and Dígito.
    - If the business address includes "United States":
        - Extract the due date and minimum payment due (if specified).
        - Extract all available payment instructions and methods, including:
            - For Local USD Payments: Account Holder, Routing Number, Bank Address, Bank Name, Account Number, and Reference.
            - For International USD Payments: Beneficiary Name, Bank Name, IBAN, Beneficiary Address, Bank Address, and SWIFT.
    - If the business address includes "Mexico":
        - Extract the due date and minimum payment due (if specified).
        - Extract all available payment instructions and methods, including:
          - For MXN Payments: CLABE Number, Account Number, Account Holder, Bank Name, RFC, and Reference.
    - If the business address includes "Colombia":
         - Extract the due date and minimum payment due (if specified).
         - Extract all available payment instructions and methods, including:
           - For COP Payments: Account Holder, Account Number, Bank Name, NIT, and Reference.
    - If the business address does NOT include "Brazil", "United States", "Mexico", or "Colombia", then extract all information related to making a payment, including due date, minimum payment due, and all available payment instructions, details for each, and payment methods.
Include details on any promotional APR periods
Provide information on rewards or cashback earned
Fees and Interest:
List all fees charged during this billing cycle
Detail the interest rates for different transaction types (purchases, cash advances, balance transfers)
Important Notices:
Extract any policy changes, important dates, or special offers mentioned in the statement
For each section, ensure you capture every piece of information present in the statement. Provide your analysis in a structured format, clearly separating each section.`,
  ]);

  return result.response.text();
}

function splitTextIntoChunks(text: string, chunkSize: number, overlap: number): string[] {
  console.log('Splitting text into chunks...')
  const chunks: string[] = []
  let startIndex = 0

  while (startIndex < text.length) {
    const endIndex = Math.min(startIndex + chunkSize, text.length)
    chunks.push(text.slice(startIndex, endIndex))
    startIndex += chunkSize - overlap
  }

  console.log(`Text split into ${chunks.length} chunks`)
  return chunks
}

async function createEmbedding(text: string): Promise<number[]> {
  try {
    console.log('Creating embedding...')
    const response = await openai.createEmbedding({
      model: 'text-embedding-ada-002',
      input: text,
    })

    const result = await response.json()
    if (!result.data || !result.data[0] || !result.data[0].embedding) {
      throw new Error('Invalid response from OpenAI API')
    }
    console.log('Embedding created successfully')
    return result.data[0].embedding
  } catch (error) {
    console.error('Error creating embedding:', error)
    if (error instanceof Error) {
      throw new Error(`Failed to create embedding: ${error.message}`)
    } else {
      throw new Error('Failed to create embedding: Unknown error')
    }
  }
}

