'use client'

import { useState } from 'react'
import UploadForm from "./UploadForm"
import ChatInterface from "./ChatInterface"
import InitiateStatement from "./InitiateStatement"

export default function TabInterface() {
  const [activeTab, setActiveTab] = useState('statements')

  return (
    <div className="w-full">
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('statements')}
            className={`${
              activeTab === 'statements'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium`}
          >
            Upload and Send Statement
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`${
              activeTab === 'chat'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium`}
          >
            Debug
          </button>
        </nav>
      </div>

      <div className="mt-4">
        {activeTab === 'statements' && (
          <div className="space-y-6">
            <UploadForm />
            <InitiateStatement />
          </div>
        )}
        {activeTab === 'chat' && <ChatInterface />}
      </div>
    </div>
  )
}