-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('TELEGRAM', 'WHATSAPP');

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "credentials" JSONB NOT NULL DEFAULT '{}',
    "webhookSecret" TEXT NOT NULL,
    "externalRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Integration_webhookSecret_key" ON "Integration"("webhookSecret");

-- CreateIndex
CREATE INDEX "Integration_chatbotId_idx" ON "Integration"("chatbotId");

-- CreateIndex
CREATE INDEX "Integration_externalRef_idx" ON "Integration"("externalRef");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_chatbotId_provider_key" ON "Integration"("chatbotId", "provider");

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
