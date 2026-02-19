import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse
} from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { ErrorResponseDto } from "../../common/dto/error-response.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { NoticeService } from "./notice.service";
import { ListNoticesQueryDto, ListPublicNoticesQueryDto, GetPublicNoticeQueryDto } from "./dto/list-notices.dto";
import { CreateNoticeDto } from "./dto/create-notice.dto";
import { UpdateNoticeDto } from "./dto/update-notice.dto";

@Controller()
export class NoticeController {
  constructor(private readonly noticeService: NoticeService) {}

  // ── Admin routes ──

  @Get("admin/notices")
  @ApiTags("admin")
  @Roles("ADMIN")
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "List all notices (admin)" })
  @Permissions("NOTICE_READ")
  @ApiUnauthorizedResponse({ description: "Missing or invalid token", type: ErrorResponseDto })
  @ApiForbiddenResponse({ description: "Insufficient role or permission", type: ErrorResponseDto })
  async listNotices(@Query() query: ListNoticesQueryDto) {
    return this.noticeService.listNotices(query);
  }

  @Post("admin/notices")
  @ApiTags("admin")
  @Roles("ADMIN")
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Create notice" })
  @Permissions("NOTICE_WRITE")
  @ApiUnauthorizedResponse({ description: "Missing or invalid token", type: ErrorResponseDto })
  @ApiForbiddenResponse({ description: "Insufficient role or permission", type: ErrorResponseDto })
  async createNotice(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateNoticeDto
  ) {
    return this.noticeService.createNotice(body, user.sub);
  }

  @Patch("admin/notices/:noticeId")
  @ApiTags("admin")
  @Roles("ADMIN")
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Update notice" })
  @ApiParam({ name: "noticeId", description: "Notice ID" })
  @Permissions("NOTICE_WRITE")
  @ApiUnauthorizedResponse({ description: "Missing or invalid token", type: ErrorResponseDto })
  @ApiForbiddenResponse({ description: "Insufficient role or permission", type: ErrorResponseDto })
  async updateNotice(
    @CurrentUser() user: AuthenticatedUser,
    @Param("noticeId") noticeId: string,
    @Body() body: UpdateNoticeDto
  ) {
    return this.noticeService.updateNotice(noticeId, body, user.sub);
  }

  @Delete("admin/notices/:noticeId")
  @ApiTags("admin")
  @Roles("ADMIN")
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Delete notice" })
  @ApiParam({ name: "noticeId", description: "Notice ID" })
  @Permissions("NOTICE_WRITE")
  @ApiUnauthorizedResponse({ description: "Missing or invalid token", type: ErrorResponseDto })
  @ApiForbiddenResponse({ description: "Insufficient role or permission", type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: "Notice not found", type: ErrorResponseDto })
  async deleteNotice(
    @CurrentUser() user: AuthenticatedUser,
    @Param("noticeId") noticeId: string
  ) {
    return this.noticeService.deleteNotice(noticeId, user.sub);
  }

  @Post("admin/notices/:noticeId/translate")
  @ApiTags("admin")
  @Roles("ADMIN")
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Auto-translate notice to all supported languages" })
  @ApiParam({ name: "noticeId", description: "Notice ID" })
  @Permissions("NOTICE_WRITE")
  @ApiUnauthorizedResponse({ description: "Missing or invalid token", type: ErrorResponseDto })
  @ApiForbiddenResponse({ description: "Insufficient role or permission", type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: "Notice not found", type: ErrorResponseDto })
  async translateNotice(
    @CurrentUser() user: AuthenticatedUser,
    @Param("noticeId") noticeId: string
  ) {
    return this.noticeService.translateNotice(noticeId, user.sub);
  }

  // ── Public routes ──

  @Get("notices")
  @ApiTags("notice")
  @ApiOperation({ summary: "List published notices (public)" })
  async listPublicNotices(@Query() query: ListPublicNoticesQueryDto) {
    return this.noticeService.listPublicNotices(query);
  }

  @Get("notices/:noticeId")
  @ApiTags("notice")
  @ApiOperation({ summary: "Get published notice by ID (public)" })
  @ApiParam({ name: "noticeId", description: "Notice ID" })
  @ApiNotFoundResponse({ description: "Notice not found", type: ErrorResponseDto })
  async getPublicNotice(
    @Param("noticeId") noticeId: string,
    @Query() query: GetPublicNoticeQueryDto
  ) {
    return this.noticeService.getPublicNoticeById(noticeId, query.locale);
  }
}
