'use client'

import { useState, useEffect } from 'react'
import { sendMessage } from '../app/actions/sendMessage'

interface Message {
  id: number;
  message: string;
  is_from_business: boolean;
  whatsapp_status?: 'sent' | 'failed';
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [orgId, setOrgId] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Load chat history when component mounts
    loadChatHistory()
  }, [])

  const loadChatHistory = async () => {
    // Implement this function to load chat history from the database
    console.log('Loading chat history...')
    // For now, we'll leave it empty
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Submit button clicked')
    if (!input || !orgId || !phoneNumber) {
      console.log('Missing required fields')
      return
    }

    setIsLoading(true)
    const userMessage: Message = {
      id: Date.now(),
      message: input,
      is_from_business: false,
    }

    setMessages(prevMessages => [...prevMessages, userMessage])
    setInput('')

    try {
      console.log('Sending message:', { orgId, phoneNumber, input })
      const response = await sendMessage(orgId, phoneNumber, input)
      console.log('Received response:', response)
      const botMessage: Message = {
        id: Date.now() + 1,
        message: response.message,
        is_from_business: true,
        whatsapp_status: response.whatsapp_status
      }
      setMessages(prevMessages => [...prevMessages, botMessage])
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: Date.now() + 1,
        message: error instanceof Error ? error.message : "Sorry, there was an error processing your message. Please try again.",
        is_from_business: true,
        whatsapp_status: 'failed'
      };
      setMessages(prevMessages => [...prevMessages, errorMessage]);
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="mt-8">
      <div className="mb-4">
        <label htmlFor="chatOrgId" className="block mb-2">Org ID:</label>
        <input
          type="text"
          id="chatOrgId"
          value={orgId}
          onChange={(e) => setOrgId(e.target.value)}
          required
          className="w-full p-2 border rounded"
        />
      </div>
      <div className="mb-4">
        <label htmlFor="chatPhoneNumber" className="block mb-2">Phone Number:</label>
        <input
          type="tel"
          id="chatPhoneNumber"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          required
          className="w-full p-2 border rounded"
        />
      </div>
      <div className="border rounded p-4 h-64 overflow-y-auto mb-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`mb-2 flex items-start gap-2 ${
              msg.is_from_business ? 'text-blue-600' : 'text-gray-800'
            }`}
          >
            <div className="flex-grow">{msg.message}</div>
            {msg.whatsapp_status && (
              <span className={`text-xs ${msg.whatsapp_status === 'sent' ? 'text-green-500' : 'text-red-500'}`}>
                {msg.whatsapp_status === 'sent' ? '✓ WhatsApp' : '⚠️ WhatsApp failed'}
              </span>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="flex">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-grow p-2 border rounded-l"
          placeholder="Ask a question about your credit card statement..."
        />
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded-r disabled:bg-gray-400"
          disabled={isLoading}
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  )
}

