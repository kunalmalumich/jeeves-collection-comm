import UploadForm from "../components/UploadForm"
import ChatInterface from "../components/ChatInterface"
import InitiateStatement from "../components/InitiateStatement"

export default function Home() {
  return (
    <main className="container mx-auto p-4 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        Credit Card Statement Chat
      </h1>
      <div className="grid gap-6">
        <UploadForm />
        <InitiateStatement />
        <ChatInterface />
      </div>
    </main>
  )
}

