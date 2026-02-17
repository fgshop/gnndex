import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreateSupportTicketDto } from "./dto/create-support-ticket.dto";
import { ListMySupportTicketsQueryDto } from "./dto/list-my-support-tickets.dto";

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  private serializeTicket(row: {
    id: string;
    category: string;
    subject: string;
    content: string;
    contactEmail: string;
    status: string;
    adminReply: string | null;
    createdAt: Date;
    updatedAt: Date;
    repliedAt: Date | null;
  }) {
    return {
      ticketId: row.id,
      category: row.category,
      subject: row.subject,
      content: row.content,
      contactEmail: row.contactEmail,
      status: row.status,
      adminReply: row.adminReply,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      repliedAt: row.repliedAt?.toISOString() ?? null
    };
  }

  async createTicket(
    user: { userId: string; email: string },
    input: CreateSupportTicketDto
  ) {
    const ticket = await this.prisma.supportTicket.create({
      data: {
        userId: user.userId,
        category: input.category.trim().toUpperCase(),
        subject: input.subject.trim(),
        content: input.content.trim(),
        contactEmail: input.contactEmail?.trim() || user.email
      }
    });

    await this.auditService.log({
      actorUserId: user.userId,
      actorEmail: user.email,
      action: "SUPPORT_TICKET_CREATED",
      targetType: "SUPPORT_TICKET",
      targetId: ticket.id,
      metadata: {
        category: ticket.category,
        status: ticket.status
      }
    });

    return this.serializeTicket(ticket);
  }

  async listMyTickets(userId: string, query: ListMySupportTicketsQueryDto) {
    const limit = query.limit ?? 30;
    const rows = await this.prisma.supportTicket.findMany({
      where: {
        userId,
        status: query.status || undefined
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 100)
    });

    return rows.map((row) => this.serializeTicket(row));
  }

  async getMyTicket(userId: string, ticketId: string) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: {
        id: ticketId,
        userId
      }
    });

    if (!ticket) {
      throw new NotFoundException("Support ticket not found");
    }

    return this.serializeTicket(ticket);
  }
}
