"use client"

import { useState, useEffect } from "react"
import { env } from "../app/config/env"

export default function InitiateStatement() {
  useEffect(() => {
    console.log("NEXT_PUBLIC_APP_URL:", env.NEXT_PUBLIC_APP_URL)
  }, [])
  console.log("NEXT_PUBLIC_APP_URL:", env.NEXT_PUBLIC_APP_URL)
  const [customerPhone, setCustomerPhone] = useState("")
  const [month, setMonth] = useState("")
  const [amount, setAmount] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [status, setStatus] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus("Initiating statement conversation...")
    console.log("Initiating statement conversation with data:", { customerPhone, month, amount, dueDate })

    try {
      const url = `${env.NEXT_PUBLIC_APP_URL}/api/initiate-statement`
      console.log("Sending request to:", url)

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: 'include',
        mode: 'cors',
        body: JSON.stringify({
          customerPhone,
          statementData: { month, amount, dueDate },
        }),
      })

      console.log("Response status:", response.status)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log("Response data:", data)

      setStatus(`Statement conversation initiated. Conversation SID: ${data.conversationSid}`)
    } catch (error) {
      console.error("Fetch error:", error)
      if (error instanceof Error) {
        setStatus(`Error: ${error.message}`)
        console.error("Error details:", error.stack)
      } else {
        setStatus("An unknown error occurred")
        console.error("Unknown error:", error)
      }
    }
  }

  return (
    <div className="mt-8">
      <h2 className="text-2xl font-bold mb-4">Initiate Statement Conversation</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="customerPhone" className="block mb-2">
            Customer Phone:
          </label>
          <input
            type="tel"
            id="customerPhone"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            required
            className="w-full p-2 border rounded"
          />
        </div>
        <div>
          <label htmlFor="month" className="block mb-2">
            Statement Month:
          </label>
          <input
            type="text"
            id="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            required
            className="w-full p-2 border rounded"
          />
        </div>
        <div>
          <label htmlFor="amount" className="block mb-2">
            Statement Amount:
          </label>
          <input
            type="text"
            id="amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            className="w-full p-2 border rounded"
          />
        </div>
        <div>
          <label htmlFor="dueDate" className="block mb-2">
            Due Date:
          </label>
          <input
            type="text"
            id="dueDate"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
            className="w-full p-2 border rounded"
          />
        </div>
        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
          Initiate Statement Conversation
        </button>
      </form>
      {status && <p className="mt-4">{status}</p>}
    </div>
  )
}

