export type DailyCount = {
  date: string
  count: number
}

export type OverviewAnalytics = {
  chatbots: {
    total: number
    active: number
    draft: number
    archived: number
  }
  conversations: {
    total: number
    open: number
    closed: number
  }
  messages: {
    total: number
    user: number
    bot: number
    system: number
  }
  flows: {
    total: number
    published: number
  }
}

export type ChatbotAnalytics = {
  chatbotId: string
  chatbotName: string
  status: string
  conversations: {
    total: number
    open: number
    closed: number
  }
  messages: {
    total: number
    user: number
    bot: number
    system: number
  }
  flows: {
    total: number
    published: number
  }
  messagesByDay: DailyCount[]
}
