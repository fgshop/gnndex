import {
  Body,
  Controller,
  Get,
  MessageEvent,
  Post,
  Query,
  Sse,
  UseGuards
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
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
import { AdjustBalanceDto } from "./dto/adjust-balance.dto";
import { CreateWalletDto } from "./dto/create-wallet.dto";
import { SimulateDepositDto } from "./dto/simulate-deposit.dto";
import { ListMyWithdrawalsQueryDto } from "./dto/list-my-withdrawals.dto";
import { RequestWithdrawalDto } from "./dto/request-withdrawal.dto";
import { StreamBalancesQueryDto } from "./dto/stream-balances.dto";
import { WalletService } from "./wallet.service";

@ApiTags("wallet")
@Controller("wallet")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("bearer")
@ApiUnauthorizedResponse({ description: "Missing or invalid token", type: ErrorResponseDto })
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get("networks")
  @ApiOperation({ summary: "Get supported coin/network configurations" })
  getNetworks() {
    return this.walletService.getNetworkConfig();
  }

  @Get("balances")
  @ApiOperation({ summary: "Get wallet balances" })
  async getBalances(@CurrentUser() user: AuthenticatedUser) {
    return this.walletService.getBalancesByUserId(user.sub);
  }

  @Sse("stream/balances")
  @ApiOperation({ summary: "Stream wallet balances (SSE)" })
  @ApiProduces("text/event-stream")
  streamBalances(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: StreamBalancesQueryDto
  ): Observable<MessageEvent> {
    return this.walletService.streamBalances(user.sub, query).pipe(
      map((payload) => ({
        data: payload
      }))
    );
  }

  @Post("wallets")
  @ApiOperation({ summary: "Create wallet (generate deposit address)" })
  @ApiBadRequestResponse({ description: "Invalid asset", type: ErrorResponseDto })
  async createWallet(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateWalletDto
  ) {
    return this.walletService.createWallet(user.sub, body);
  }

  @Get("ledger")
  @ApiOperation({ summary: "Get wallet ledger entries" })
  async getLedger(@CurrentUser() user: AuthenticatedUser, @Query("limit") limit?: string) {
    return this.walletService.getLedgerByUserId(user.sub, Number(limit ?? 100));
  }

  @Post("withdrawals")
  @ApiOperation({ summary: "Request withdrawal" })
  @ApiBadRequestResponse({ description: "Invalid withdrawal request", type: ErrorResponseDto })
  async requestWithdrawal(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: RequestWithdrawalDto
  ) {
    return this.walletService.requestWithdrawal(user.sub, body);
  }

  @Get("withdrawals")
  @ApiOperation({ summary: "List my withdrawals" })
  async listWithdrawals(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListMyWithdrawalsQueryDto
  ) {
    return this.walletService.listWithdrawalsByUserId(user.sub, query);
  }

  @Post("deposit")
  @ApiOperation({ summary: "Simulate deposit (development)" })
  @ApiBadRequestResponse({ description: "Invalid deposit request", type: ErrorResponseDto })
  async simulateDeposit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: SimulateDepositDto
  ) {
    return this.walletService.simulateDeposit(user.sub, body.asset, body.amount);
  }

  @Post("admin-adjust")
  @ApiOperation({ summary: "Admin adjust available balance (development only)" })
  @ApiForbiddenResponse({ description: "Insufficient role or permission", type: ErrorResponseDto })
  @Roles("ADMIN")
  @Permissions("BALANCE_ADJUST")
  @UseGuards(RolesGuard, PermissionsGuard)
  async adminAdjustBalance(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AdjustBalanceDto
  ) {
    return this.walletService.adminAdjustBalance(body, {
      userId: user.sub,
      email: user.email
    });
  }
}
