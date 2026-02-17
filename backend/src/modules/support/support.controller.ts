import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ErrorResponseDto } from "../../common/dto/error-response.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { CreateSupportTicketDto } from "./dto/create-support-ticket.dto";
import { ListMySupportTicketsQueryDto } from "./dto/list-my-support-tickets.dto";
import { SupportService } from "./support.service";

@ApiTags("support")
@Controller("support")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("bearer")
@ApiUnauthorizedResponse({ description: "Missing or invalid token", type: ErrorResponseDto })
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post("tickets")
  @ApiOperation({ summary: "Create support ticket" })
  createTicket(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateSupportTicketDto) {
    return this.supportService.createTicket(
      {
        userId: user.sub,
        email: user.email
      },
      body
    );
  }

  @Get("tickets/mine")
  @ApiOperation({ summary: "List my support tickets" })
  listMyTickets(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListMySupportTicketsQueryDto
  ) {
    return this.supportService.listMyTickets(user.sub, query);
  }

  @Get("tickets/mine/:ticketId")
  @ApiOperation({ summary: "Get my support ticket detail" })
  @ApiParam({ name: "ticketId", description: "Support ticket ID" })
  @ApiNotFoundResponse({ description: "Ticket not found", type: ErrorResponseDto })
  getMyTicket(@CurrentUser() user: AuthenticatedUser, @Param("ticketId") ticketId: string) {
    return this.supportService.getMyTicket(user.sub, ticketId);
  }
}
