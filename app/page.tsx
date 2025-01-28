import TabInterface from "../components/TabInterface"

export default function Home() {
  return (
    <main className="container mx-auto p-4 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        Credit Statement Chat
      </h1>
      <TabInterface />
    </main>
  )
}

