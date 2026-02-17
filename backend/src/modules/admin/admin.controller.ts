import {
  Body,
  Controller,
  Get,
  MessageEvent,
  Param,
  Patch,
  Post,
  Query,
  Sse,
  UseGuards
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiGoneResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Observable, map } from "rxjs";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { ErrorResponseDto } from "../../common/dto/error-response.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { AdminService } from "./admin.service";
import { BroadcastWithdrawalDto } from "./dto/broadcast-withdrawal.dto";
import { CreateCoinListingDto } from "./dto/create-coin-listing.dto";
import { CreateDashboardShareLinkDto } from "./dto/create-dashboard-share-link.dto";
import { DashboardOverviewQueryDto } from "./dto/dashboard-overview.dto";
import { FailWithdrawalDto } from "./dto/fail-withdrawal.dto";
import { GetDashboardShareLinkParamDto } from "./dto/get-dashboard-share-link.dto";
import { ListAdminPermissionsQueryDto } from "./dto/list-admin-permissions.dto";
import { ListAuditLogsQueryDto } from "./dto/list-audit-logs.dto";
import { ListOrdersQueryDto } from "./dto/list-orders.dto";
import { ListUsersQueryDto } from "./dto/list-users.dto";
import { ListSupportTicketsQueryDto } from "./dto/list-support-tickets.dto";
import { ListWithdrawalsQueryDto } from "./dto/list-withdrawals.dto";
import { ListWalletLedgerQueryDto } from "./dto/list-wallet-ledger.dto";
import { RejectWithdrawalDto } from "./dto/reject-withdrawal.dto";
import { StreamDashboardOverviewQueryDto } from "./dto/stream-dashboard-overview.dto";
import { UpdateSupportTicketDto } from "./dto/update-support-ticket.dto";
import { UpdateAdminPermissionsDto } from "./dto/update-admin-permissions.dto";
import { UpdateCoinListingDto } from "./dto/update-coin-listing.dto";
import { UpsertCoinCandlesDto } from "./dto/upsert-coin-candles.dto";
import { GetTradeSimulatorQueryDto } from "./dto/get-trade-simulator-query.dto";
import { GetTradeSimulatorApprovalQueryDto } from "./dto/get-trade-simulator-approval-query.dto";
import { RequestTradeSimulatorLiveApprovalDto } from "./dto/request-trade-simulator-live-approval.dto";
import { ReviewTradeSimulatorLiveApprovalDto } from "./dto/review-trade-simulator-live-approval.dto";
import { UpdateTradeSimulatorDto } from "./dto/update-trade-simulator.dto";
import { TradeSimulationService } from "./trade-simulation.service";

@ApiTags("admin")
@Controller("admin")
@Roles("ADMIN")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@ApiBearerAuth("bearer")
@ApiUnauthorizedResponse({ description: "Missing or invalid token", type: ErrorResponseDto })
@ApiForbiddenResponse({ description: "Insufficient role or permission", type: ErrorResponseDto })
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly tradeSimulationService: TradeSimulationService
  ) {}

  @Get("dashboard/overview")
  @ApiOperation({
    summary: "Get dashboard overview with section-level permission checks and latest activity snapshots"
  })
  async getDashboardOverview(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DashboardOverviewQueryDto
  ) {
    return this.adminService.getDashboardOverview(query, user.sub);
  }

  @Sse("dashboard/stream")
  @ApiOperation({
    summary: "Stream dashboard overview with section-level permission checks (SSE)"
  })
  @ApiProduces("text/event-stream")
  streamDashboardOverview(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: StreamDashboardOverviewQueryDto
  ): Observable<MessageEvent> {
    return this.adminService.streamDashboardOverview(query, user.sub).pipe(
      map((payload) => ({
        data: payload
      }))
    );
  }

  @Post("dashboard/share-links")
  @ApiOperation({ summary: "Create expiring dashboard share link" })
  @ApiBadRequestResponse({ description: "Invalid share link parameters", type: ErrorResponseDto })
  async createDashboardShareLink(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateDashboardShareLinkDto
  ) {
    return this.adminService.createDashboardShareLink(body, user.sub);
  }

  @Get("dashboard/share-links/:shareCode")
  @ApiOperation({ summary: "Resolve dashboard share link payload" })
  @ApiParam({ name: "shareCode", description: "Share link code" })
  @ApiNotFoundResponse({ description: "Share link not found", type: ErrorResponseDto })
  @ApiGoneResponse({ description: "Share link expired", type: ErrorResponseDto })
  async getDashboardShareLink(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: GetDashboardShareLinkParamDto
  ) {
    return this.adminService.getDashboardShareLink(params.shareCode, user.sub);
  }

  @Get("users")
  @ApiOperation({ summary: "List users with filters and pagination" })
  @Permissions("USER_READ")
  async listUsers(@Query() query: ListUsersQueryDto) {
    return this.adminService.listUsers(query);
  }

  @Get("orders")
  @ApiOperation({ summary: "List orders with filters and pagination" })
  @Permissions("ORDER_READ")
  async listOrders(@Query() query: ListOrdersQueryDto) {
    return this.adminService.listOrders(query);
  }

  @Get("me/permissions")
  @ApiOperation({ summary: "Get current admin permission grants" })
  async getMyPermissions(@CurrentUser() user: AuthenticatedUser) {
    return this.adminService.getMyPermissions(user.sub);
  }

  @Get("coin-listings")
  @ApiOperation({ summary: "List exchange coin listings for admin management" })
  @Permissions("ADMIN_PERMISSION_READ")
  async listCoinListings() {
    return this.adminService.listCoinListings();
  }

  @Post("coin-listings")
  @ApiOperation({ summary: "Create a coin listing (or reactivate when symbol exists)" })
  @Permissions("ADMIN_PERMISSION_WRITE")
  async createCoinListing(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateCoinListingDto
  ) {
    return this.adminService.createCoinListing(body, user.sub);
  }

  @Patch("coin-listings/:symbol")
  @ApiOperation({ summary: "Update coin listing status/chart source/order" })
  @ApiParam({ name: "symbol", description: "Listing symbol (e.g. SBK-USDT)" })
  @Permissions("ADMIN_PERMISSION_WRITE")
  async updateCoinListing(
    @CurrentUser() user: AuthenticatedUser,
    @Param("symbol") symbol: string,
    @Body() body: UpdateCoinListingDto
  ) {
    return this.adminService.updateCoinListing(symbol, body, user.sub);
  }

  @Post("coin-listings/:symbol/candles")
  @ApiOperation({ summary: "Bulk upsert internal candle data for a listed coin" })
  @ApiParam({ name: "symbol", description: "Listing symbol (e.g. SBK-USDT)" })
  @Permissions("ADMIN_PERMISSION_WRITE")
  async upsertCoinCandles(
    @CurrentUser() user: AuthenticatedUser,
    @Param("symbol") symbol: string,
    @Body() body: UpsertCoinCandlesDto
  ) {
    return this.adminService.upsertCoinCandles(symbol, body, user.sub);
  }

  @Get("coin-listings/:symbol/simulator")
  @ApiOperation({ summary: "Get test-trade simulator status/config/logs for a symbol" })
  @ApiParam({ name: "symbol", description: "Listing symbol (e.g. SBK-USDT)" })
  @Permissions("ADMIN_PERMISSION_READ")
  async getTradeSimulatorStatus(
    @Param("symbol") symbol: string,
    @Query() query: GetTradeSimulatorQueryDto
  ) {
    return this.tradeSimulationService.getStatus(symbol, query.limit);
  }

  @Patch("coin-listings/:symbol/simulator")
  @ApiOperation({ summary: "Update test-trade simulator settings for a symbol" })
  @ApiParam({ name: "symbol", description: "Listing symbol (e.g. SBK-USDT)" })
  @Permissions("ADMIN_PERMISSION_WRITE")
  async updateTradeSimulator(
    @CurrentUser() user: AuthenticatedUser,
    @Param("symbol") symbol: string,
    @Body() body: UpdateTradeSimulatorDto
  ) {
    return this.tradeSimulationService.updateSettings(symbol, body, user.sub);
  }

  @Post("coin-listings/:symbol/simulator/start")
  @ApiOperation({ summary: "Start test-trade simulator for a symbol" })
  @ApiParam({ name: "symbol", description: "Listing symbol (e.g. SBK-USDT)" })
  @Permissions("ADMIN_PERMISSION_WRITE")
  async startTradeSimulator(
    @CurrentUser() user: AuthenticatedUser,
    @Param("symbol") symbol: string
  ) {
    return this.tradeSimulationService.start(symbol, user.sub);
  }

  @Post("coin-listings/:symbol/simulator/stop")
  @ApiOperation({ summary: "Stop test-trade simulator for a symbol" })
  @ApiParam({ name: "symbol", description: "Listing symbol (e.g. SBK-USDT)" })
  @Permissions("ADMIN_PERMISSION_WRITE")
  async stopTradeSimulator(
    @CurrentUser() user: AuthenticatedUser,
    @Param("symbol") symbol: string
  ) {
    return this.tradeSimulationService.stop(symbol, user.sub);
  }

  @Get("coin-listings/:symbol/simulator/live-approval")
  @ApiOperation({ summary: "Get compliance approval status/history for live market mode" })
  @ApiParam({ name: "symbol", description: "Listing symbol (e.g. SBK-USDT)" })
  @Permissions("ADMIN_PERMISSION_READ")
  async getTradeSimulatorLiveApprovalStatus(
    @Param("symbol") symbol: string,
    @Query() query: GetTradeSimulatorApprovalQueryDto
  ) {
    return this.tradeSimulationService.getLiveApprovalStatus(symbol, query.limit);
  }

  @Post("coin-listings/:symbol/simulator/live-approval/request")
  @ApiOperation({ summary: "Request compliance approval for live market mode" })
  @ApiParam({ name: "symbol", description: "Listing symbol (e.g. SBK-USDT)" })
  @Permissions("ADMIN_PERMISSION_WRITE")
  async requestTradeSimulatorLiveApproval(
    @CurrentUser() user: AuthenticatedUser,
    @Param("symbol") symbol: string,
    @Body() body: RequestTradeSimulatorLiveApprovalDto
  ) {
    return this.tradeSimulationService.requestLiveApproval(symbol, body, user.sub);
  }

  @Post("coin-listings/:symbol/simulator/live-approval/:requestId/review")
  @ApiOperation({ summary: "Approve/reject compliance request for live market mode" })
  @ApiParam({ name: "symbol", description: "Listing symbol (e.g. SBK-USDT)" })
  @ApiParam({ name: "requestId", description: "Live approval request ID" })
  @Permissions("COMPLIANCE_APPROVE")
  async reviewTradeSimulatorLiveApproval(
    @CurrentUser() user: AuthenticatedUser,
    @Param("symbol") symbol: string,
    @Param("requestId") requestId: string,
    @Body() body: ReviewTradeSimulatorLiveApprovalDto
  ) {
    return this.tradeSimulationService.reviewLiveApproval(symbol, requestId, body, user.sub);
  }

  @Get("permissions/users")
  @ApiOperation({ summary: "List admin users and permission grants" })
  @Permissions("ADMIN_PERMISSION_READ")
  async listAdminPermissions(@Query() query: ListAdminPermissionsQueryDto) {
    return this.adminService.listAdminPermissions(query);
  }

  @Patch("permissions/users/:userId")
  @ApiOperation({ summary: "Replace admin permission grants for a target admin user" })
  @ApiParam({ name: "userId", description: "Target admin user ID" })
  @Permissions("ADMIN_PERMISSION_WRITE")
  async updateAdminPermissions(
    @CurrentUser() user: AuthenticatedUser,
    @Param("userId") userId: string,
    @Body() body: UpdateAdminPermissionsDto
  ) {
    return this.adminService.updateAdminPermissions(userId, body, user.sub);
  }

  @Get("wallet-ledger")
  @ApiOperation({ summary: "List wallet ledger with filters and pagination" })
  @Permissions("WALLET_LEDGER_READ")
  async listWalletLedger(@Query() query: ListWalletLedgerQueryDto) {
    return this.adminService.listWalletLedger(query);
  }

  @Get("withdrawals")
  @ApiOperation({ summary: "List withdrawals with filters and pagination" })
  @Permissions("WITHDRAWAL_READ")
  async listWithdrawals(@Query() query: ListWithdrawalsQueryDto) {
    return this.adminService.listWithdrawals(query);
  }

  @Post("withdrawals/:withdrawalId/approve")
  @ApiOperation({ summary: "Approve pending withdrawal" })
  @ApiParam({ name: "withdrawalId", description: "Withdrawal ID" })
  @Permissions("WITHDRAWAL_APPROVE")
  async approveWithdrawal(
    @CurrentUser() user: AuthenticatedUser,
    @Param("withdrawalId") withdrawalId: string
  ) {
    return this.adminService.approveWithdrawal(withdrawalId, user.sub);
  }

  @Post("withdrawals/:withdrawalId/reject")
  @ApiOperation({ summary: "Reject pending withdrawal and unlock balance" })
  @ApiParam({ name: "withdrawalId", description: "Withdrawal ID" })
  @Permissions("WITHDRAWAL_REJECT")
  async rejectWithdrawal(
    @CurrentUser() user: AuthenticatedUser,
    @Param("withdrawalId") withdrawalId: string,
    @Body() body: RejectWithdrawalDto
  ) {
    return this.adminService.rejectWithdrawal(withdrawalId, body, user.sub);
  }

  @Post("withdrawals/:withdrawalId/broadcast")
  @ApiOperation({ summary: "Mark approved withdrawal as broadcasted with txHash" })
  @ApiParam({ name: "withdrawalId", description: "Withdrawal ID" })
  @Permissions("WITHDRAWAL_BROADCAST")
  async broadcastWithdrawal(
    @CurrentUser() user: AuthenticatedUser,
    @Param("withdrawalId") withdrawalId: string,
    @Body() body: BroadcastWithdrawalDto
  ) {
    return this.adminService.broadcastWithdrawal(withdrawalId, body, user.sub);
  }

  @Post("withdrawals/:withdrawalId/confirm")
  @ApiOperation({ summary: "Confirm broadcasted withdrawal and finalize locked balance" })
  @ApiParam({ name: "withdrawalId", description: "Withdrawal ID" })
  @Permissions("WITHDRAWAL_CONFIRM")
  async confirmWithdrawal(
    @CurrentUser() user: AuthenticatedUser,
    @Param("withdrawalId") withdrawalId: string
  ) {
    return this.adminService.confirmWithdrawal(withdrawalId, user.sub);
  }

  @Post("withdrawals/:withdrawalId/fail")
  @ApiOperation({ summary: "Mark withdrawal failed and unlock user balance" })
  @ApiParam({ name: "withdrawalId", description: "Withdrawal ID" })
  @Permissions("WITHDRAWAL_FAIL")
  async failWithdrawal(
    @CurrentUser() user: AuthenticatedUser,
    @Param("withdrawalId") withdrawalId: string,
    @Body() body: FailWithdrawalDto
  ) {
    return this.adminService.failWithdrawal(withdrawalId, body, user.sub);
  }

  @Get("audit-logs")
  @ApiOperation({ summary: "Search audit logs with filters and pagination" })
  @Permissions("AUDIT_LOG_READ")
  async listAuditLogs(@Query() query: ListAuditLogsQueryDto) {
    return this.adminService.listAuditLogs(query);
  }

  @Get("support-tickets")
  @ApiOperation({ summary: "List support tickets with filters and pagination" })
  @Permissions("SUPPORT_TICKET_READ")
  async listSupportTickets(@Query() query: ListSupportTicketsQueryDto) {
    return this.adminService.listSupportTickets(query);
  }

  @Patch("support-tickets/:ticketId")
  @ApiOperation({ summary: "Update support ticket status and admin reply" })
  @ApiParam({ name: "ticketId", description: "Support ticket ID" })
  @Permissions("SUPPORT_TICKET_REPLY")
  async updateSupportTicket(
    @CurrentUser() user: AuthenticatedUser,
    @Param("ticketId") ticketId: string,
    @Body() body: UpdateSupportTicketDto
  ) {
    return this.adminService.updateSupportTicket(ticketId, body, user.sub);
  }
}
