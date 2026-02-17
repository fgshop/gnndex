import { Controller, Get, MessageEvent, Param, Query, Sse } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { Observable, map } from "rxjs";
import { ErrorResponseDto } from "../../common/dto/error-response.dto";
import { TradingRulesResponseDto } from "./dto/trading-rules-response.dto";
import { ListCandlesQueryDto } from "./dto/list-candles.dto";
import { GetOrderbookQueryDto } from "./dto/get-orderbook.dto";
import { ListTickersQueryDto } from "./dto/list-tickers.dto";
import { StreamTickersQueryDto } from "./dto/stream-tickers.dto";
import { MarketService } from "./market.service";

@SkipThrottle()
@ApiTags("market")
@Controller("market")
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  @Get("tickers")
  @ApiOperation({ summary: "Get ticker snapshots" })
  async listTickers(@Query() query: ListTickersQueryDto) {
    return this.marketService.listTickers(query);
  }

  @Get("listed-coins")
  @ApiOperation({ summary: "Get active listed coins and chart source metadata" })
  async listListedCoins() {
    return this.marketService.listListedCoins({ activeOnly: true });
  }

  @Get("trading-rules/:symbol")
  @ApiOperation({ summary: "Get trading rules and fee rates for a symbol" })
  @ApiParam({ name: "symbol", description: "Market symbol (e.g. BTC-USDT)", example: "BTC-USDT" })
  @ApiResponse({ status: 200, description: "Trading rules", type: TradingRulesResponseDto })
  @ApiBadRequestResponse({ description: "Invalid symbol format", type: ErrorResponseDto })
  getTradingRules(@Param("symbol") symbol: string) {
    return this.marketService.getTradingRules(symbol);
  }

  @Sse("stream/tickers")
  @ApiOperation({ summary: "Stream ticker snapshots (SSE)" })
  @ApiProduces("text/event-stream")
  streamTickers(@Query() query: StreamTickersQueryDto): Observable<MessageEvent> {
    return this.marketService.streamTickers(query).pipe(
      map((payload) => ({
        data: payload
      }))
    );
  }

  @Get("orderbook/:symbol")
  @ApiOperation({ summary: "Get aggregated orderbook" })
  @ApiParam({ name: "symbol", description: "Market symbol (e.g. BTC-USDT)", example: "BTC-USDT" })
  @ApiNotFoundResponse({ description: "Symbol not found", type: ErrorResponseDto })
  async getOrderbook(@Param("symbol") symbol: string, @Query() query: GetOrderbookQueryDto) {
    return this.marketService.getOrderbook(symbol, query);
  }

  @Get("candles")
  @ApiOperation({ summary: "Get OHLCV candles" })
  @ApiBadRequestResponse({ description: "Invalid interval or missing symbol", type: ErrorResponseDto })
  async listCandles(@Query() query: ListCandlesQueryDto) {
    return this.marketService.listCandles(query);
  }
}
