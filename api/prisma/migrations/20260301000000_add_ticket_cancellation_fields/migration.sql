-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "cancelled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Ticket" ADD COLUMN "cancelledTicketId" TEXT;
ALTER TABLE "Ticket" ADD COLUMN "cancellationReason" TEXT;
