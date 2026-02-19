import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { NoticeCategory, Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../database/prisma.service";
import { TranslationService, type TranslationsMap } from "./translation.service";
import { ListNoticesQueryDto, ListPublicNoticesQueryDto } from "./dto/list-notices.dto";
import { CreateNoticeDto } from "./dto/create-notice.dto";
import { UpdateNoticeDto } from "./dto/update-notice.dto";

type TranslatedContent = { title: string; summary: string; content: string };

function extractLocaleContent(
  notice: { title: string; summary: string; content: string; translations: Prisma.JsonValue },
  locale?: string
): { title: string; summary: string; content: string } {
  if (!locale || locale === "ko") {
    return { title: notice.title, summary: notice.summary, content: notice.content };
  }

  const translations = notice.translations as Record<string, TranslatedContent> | null;
  const localeData = translations?.[locale];

  if (localeData?.title && localeData?.summary && localeData?.content) {
    return { title: localeData.title, summary: localeData.summary, content: localeData.content };
  }

  return { title: notice.title, summary: notice.summary, content: notice.content };
}

@Injectable()
export class NoticeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly translationService: TranslationService
  ) {}

  private async resolveAdminEmail(adminUserId: string): Promise<string | null> {
    const admin = await this.prisma.user.findUnique({
      where: { id: adminUserId },
      select: { email: true }
    });
    return admin?.email ?? null;
  }

  async listNotices(query: ListNoticesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const fromCreatedAt = query.fromCreatedAt ? new Date(query.fromCreatedAt) : undefined;
    const toCreatedAt = query.toCreatedAt ? new Date(query.toCreatedAt) : undefined;

    if (fromCreatedAt && toCreatedAt && fromCreatedAt.getTime() > toCreatedAt.getTime()) {
      throw new BadRequestException("fromCreatedAt must be less than or equal to toCreatedAt");
    }

    const where: Prisma.NoticeWhereInput = {
      category: query.category ? (query.category as NoticeCategory) : undefined,
      isPublished: query.isPublished,
      isPinned: query.isPinned,
      createdAt: fromCreatedAt || toCreatedAt ? { gte: fromCreatedAt, lte: toCreatedAt } : undefined
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.notice.findMany({
        where,
        orderBy: [{ isPinned: "desc" }, { displayOrder: "asc" }, { createdAt: "desc" }],
        skip,
        take: limit
      }),
      this.prisma.notice.count({ where })
    ]);

    return {
      items: items.map((notice) => ({
        id: notice.id,
        category: notice.category,
        title: notice.title,
        summary: notice.summary,
        content: notice.content,
        translations: notice.translations,
        isPinned: notice.isPinned,
        isPublished: notice.isPublished,
        displayOrder: notice.displayOrder,
        createdByUserId: notice.createdByUserId,
        publishedAt: notice.publishedAt?.toISOString() ?? null,
        createdAt: notice.createdAt.toISOString(),
        updatedAt: notice.updatedAt.toISOString()
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1)
      }
    };
  }

  async listPublicNotices(query: ListPublicNoticesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const locale = query.locale;

    const where: Prisma.NoticeWhereInput = {
      isPublished: true,
      category: query.category ? (query.category as NoticeCategory) : undefined
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.notice.findMany({
        where,
        orderBy: [{ isPinned: "desc" }, { displayOrder: "asc" }, { createdAt: "desc" }],
        skip,
        take: limit
      }),
      this.prisma.notice.count({ where })
    ]);

    return {
      items: items.map((notice) => {
        const localized = extractLocaleContent(notice, locale);
        return {
          id: notice.id,
          category: notice.category,
          title: localized.title,
          summary: localized.summary,
          content: localized.content,
          isPinned: notice.isPinned,
          publishedAt: notice.publishedAt?.toISOString() ?? null,
          createdAt: notice.createdAt.toISOString()
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1)
      }
    };
  }

  async getPublicNoticeById(noticeId: string, locale?: string) {
    const notice = await this.prisma.notice.findUnique({
      where: { id: noticeId }
    });

    if (!notice || !notice.isPublished) {
      throw new NotFoundException("Notice not found");
    }

    const localized = extractLocaleContent(notice, locale);

    return {
      id: notice.id,
      category: notice.category,
      title: localized.title,
      summary: localized.summary,
      content: localized.content,
      isPinned: notice.isPinned,
      publishedAt: notice.publishedAt?.toISOString() ?? null,
      createdAt: notice.createdAt.toISOString()
    };
  }

  async createNotice(input: CreateNoticeDto, adminUserId: string) {
    const category = (input.category ?? "NOTICE") as NoticeCategory;
    const isPublished = input.isPublished ?? false;

    const notice = await this.prisma.notice.create({
      data: {
        category,
        title: input.title,
        summary: input.summary,
        content: input.content,
        translations: input.translations ? (input.translations as Prisma.InputJsonValue) : undefined,
        isPinned: input.isPinned ?? false,
        isPublished,
        displayOrder: input.displayOrder ?? 0,
        createdByUserId: adminUserId,
        publishedAt: isPublished ? new Date() : null
      }
    });

    const adminEmail = await this.resolveAdminEmail(adminUserId);
    await this.auditService.log({
      actorUserId: adminUserId,
      actorEmail: adminEmail,
      action: "NOTICE_CREATED",
      targetType: "NOTICE",
      targetId: notice.id,
      metadata: {
        category,
        title: input.title,
        isPublished
      }
    });

    return {
      id: notice.id,
      category: notice.category,
      title: notice.title,
      summary: notice.summary,
      content: notice.content,
      translations: notice.translations,
      isPinned: notice.isPinned,
      isPublished: notice.isPublished,
      displayOrder: notice.displayOrder,
      createdByUserId: notice.createdByUserId,
      publishedAt: notice.publishedAt?.toISOString() ?? null,
      createdAt: notice.createdAt.toISOString(),
      updatedAt: notice.updatedAt.toISOString()
    };
  }

  async updateNotice(noticeId: string, input: UpdateNoticeDto, adminUserId: string) {
    const existing = await this.prisma.notice.findUnique({
      where: { id: noticeId }
    });

    if (!existing) {
      throw new NotFoundException("Notice not found");
    }

    const data: Prisma.NoticeUpdateInput = {};

    if (input.category !== undefined) {
      data.category = input.category as NoticeCategory;
    }
    if (input.title !== undefined) {
      data.title = input.title;
    }
    if (input.summary !== undefined) {
      data.summary = input.summary;
    }
    if (input.content !== undefined) {
      data.content = input.content;
    }
    if (input.translations !== undefined) {
      data.translations = input.translations as Prisma.InputJsonValue;
    }
    if (input.isPinned !== undefined) {
      data.isPinned = input.isPinned;
    }
    if (input.displayOrder !== undefined) {
      data.displayOrder = input.displayOrder;
    }
    if (input.isPublished !== undefined) {
      data.isPublished = input.isPublished;
      if (input.isPublished && !existing.isPublished) {
        data.publishedAt = new Date();
      }
      if (!input.isPublished) {
        data.publishedAt = null;
      }
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException("No fields to update");
    }

    const updated = await this.prisma.notice.update({
      where: { id: noticeId },
      data
    });

    const adminEmail = await this.resolveAdminEmail(adminUserId);
    await this.auditService.log({
      actorUserId: adminUserId,
      actorEmail: adminEmail,
      action: "NOTICE_UPDATED",
      targetType: "NOTICE",
      targetId: updated.id,
      metadata: {
        previousIsPublished: existing.isPublished,
        nextIsPublished: updated.isPublished,
        title: updated.title
      }
    });

    return {
      id: updated.id,
      category: updated.category,
      title: updated.title,
      summary: updated.summary,
      content: updated.content,
      translations: updated.translations,
      isPinned: updated.isPinned,
      isPublished: updated.isPublished,
      displayOrder: updated.displayOrder,
      createdByUserId: updated.createdByUserId,
      publishedAt: updated.publishedAt?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString()
    };
  }

  async deleteNotice(noticeId: string, adminUserId: string) {
    const existing = await this.prisma.notice.findUnique({
      where: { id: noticeId }
    });

    if (!existing) {
      throw new NotFoundException("Notice not found");
    }

    await this.prisma.notice.delete({ where: { id: noticeId } });

    const adminEmail = await this.resolveAdminEmail(adminUserId);
    await this.auditService.log({
      actorUserId: adminUserId,
      actorEmail: adminEmail,
      action: "NOTICE_DELETED",
      targetType: "NOTICE",
      targetId: noticeId,
      metadata: {
        title: existing.title,
        category: existing.category
      }
    });

    return { deleted: true };
  }

  async translateNotice(noticeId: string, adminUserId: string) {
    const notice = await this.prisma.notice.findUnique({
      where: { id: noticeId }
    });

    if (!notice) {
      throw new NotFoundException("Notice not found");
    }

    const translations = await this.translationService.translateNoticeContent(
      notice.title,
      notice.summary,
      notice.content
    );

    const existingTranslations = (notice.translations as TranslationsMap) ?? {};
    const mergedTranslations = { ...existingTranslations, ...translations };

    const updated = await this.prisma.notice.update({
      where: { id: noticeId },
      data: {
        translations: mergedTranslations as Prisma.InputJsonValue
      }
    });

    const adminEmail = await this.resolveAdminEmail(adminUserId);
    await this.auditService.log({
      actorUserId: adminUserId,
      actorEmail: adminEmail,
      action: "NOTICE_TRANSLATED",
      targetType: "NOTICE",
      targetId: noticeId,
      metadata: {
        title: notice.title,
        translatedLanguages: Object.keys(translations)
      }
    });

    return {
      id: updated.id,
      translations: updated.translations,
      translatedLanguages: Object.keys(translations)
    };
  }
}
