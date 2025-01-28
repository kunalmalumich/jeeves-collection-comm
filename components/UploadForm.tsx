"use client"

import { useState } from "react"
import { uploadPDF } from "../app/actions/uploadPDF"
import { sendStatement } from "../app/actions/sendStatement"

export default function UploadForm() {
  const [file, setFile] = useState<File | null>(null)
  const [orgId, setOrgId] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState("")
  const [isSendingStatement, setIsSendingStatement] = useState(false)
  const [sendStatementStatus, setSendStatementStatus] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !orgId || !phoneNumber) return

    setIsUploading(true)
    setUploadStatus("Uploading...")

    const formData = new FormData()
    formData.append("file", file)
    formData.append("orgId", orgId)
    formData.append("phoneNumber", phoneNumber)

    try {
      const result = await uploadPDF(formData)
      setUploadStatus(result.message)
    } catch (error) {
      setUploadStatus("Upload failed. Please try again.")
    } finally {
      setIsUploading(false)
    }
  }

  const handleSendStatement = async () => {
    console.log("handleSendStatement called")
    console.log("orgId:", orgId)
    console.log("phoneNumber:", phoneNumber)
    if (!orgId || !phoneNumber) {
      setSendStatementStatus("Please provide both Org ID and Phone Number.")
      return
    }

    setIsSendingStatement(true)
    setSendStatementStatus("Sending statement...")

    const formData = new FormData()
    formData.append("orgId", orgId)
    formData.append("phoneNumber", phoneNumber)

    try {
      const result = await sendStatement(formData)
      if (result.success) {
        setSendStatementStatus(result.message)
      } else {
        setSendStatementStatus(`Failed to send statement: ${result.error}`)
        console.error("Error details:", result.error)
      }
    } catch (error) {
      console.error("Error in handleSendStatement:", error)
      setSendStatementStatus("An unexpected error occurred. Please check the console for more details.")
    } finally {
      setIsSendingStatement(false)
    }
  }

  return (
    <div className="mb-8">
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="mb-4">
          <label htmlFor="file" className="block mb-2">
            PDF File:
          </label>
          <input
            type="file"
            id="file"
            accept=".pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            required
            className="w-full p-2 border rounded"
          />
        </div>
        <div className="mb-4">
          <label htmlFor="orgId" className="block mb-2">
            Org ID:
          </label>
          <input
            type="text"
            id="orgId"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            required
            className="w-full p-2 border rounded"
          />
        </div>
        <div className="mb-4">
          <label htmlFor="phoneNumber" className="block mb-2">
            Phone Number:
          </label>
          <input
            type="tel"
            id="phoneNumber"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            required
            className="w-full p-2 border rounded"
          />
        </div>
        <button
          type="submit"
          disabled={isUploading}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-400"
        >
          {isUploading ? "Uploading..." : "Upload PDF"}
        </button>
        {uploadStatus && <p className="mt-2">{uploadStatus}</p>}
      </form>
    </div>
  )
}

