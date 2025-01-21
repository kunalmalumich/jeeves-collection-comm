"use client"

import { useState } from "react"
import { sendStatement } from "../app/actions/sendStatement"

export default function SendStatement() {
  const [orgId, setOrgId] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [status, setStatus] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgId || !phoneNumber) {
      setStatus("Please fill in all fields")
      return
    }

    setIsSending(true)
    setStatus("Sending statement...")

    const formData = new FormData()
    formData.append("orgId", orgId)
    formData.append("phoneNumber", phoneNumber)

    try {
      const result = await sendStatement(formData)
      if (result.success) {
        setStatus("Statement sent successfully")
      } else {
        setStatus(`Failed to send statement: ${result.error}`)
      }
    } catch (error) {
      setStatus("An unexpected error occurred")
      console.error("Error in handleSubmit:", error)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="mt-8 p-4 bg-gray-100 rounded-lg">
      <h2 className="text-xl font-bold mb-4">Send Statement</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="orgId" className="block mb-1">
            Organization ID:
          </label>
          <input
            type="text"
            id="orgId"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
        </div>
        <div>
          <label htmlFor="phoneNumber" className="block mb-1">
            Phone Number:
          </label>
          <input
            type="tel"
            id="phoneNumber"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
        </div>
        <button
          type="submit"
          disabled={isSending}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-400"
        >
          {isSending ? "Sending..." : "Send Statement"}
        </button>
      </form>
      {status && <p className="mt-4 text-center">{status}</p>}
    </div>
  )
}

