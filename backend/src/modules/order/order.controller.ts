import {
  Body,
  Controller,
  Delete,
  Get,
  MessageEvent,
  Param,
  Post,
  Query,
  Sse,
  UseGuards
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Observable, map } from "rxjs";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ErrorResponseDto } from "../../common/dto/error-response.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { CreateOrderDto } from "./dto/create-order.dto";
import { ListOrdersQueryDto } from "./dto/list-orders.dto";
import { StreamOrdersQueryDto } from "./dto/stream-orders.dto";
import { OrderService } from "./order.service";

@ApiTags("orders")
@Controller("orders")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("bearer")
@ApiUnauthorizedResponse({ description: "Missing or invalid token", type: ErrorResponseDto })
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @ApiOperation({ summary: "Create spot order" })
  @ApiBadRequestResponse({ description: "Invalid order parameters", type: ErrorResponseDto })
  createOrder(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateOrderDto) {
    return this.orderService.createOrder(user.sub, body);
  }

  @Delete(":orderId")
  @ApiOperation({ summary: "Cancel order" })
  @ApiParam({ name: "orderId", description: "Order ID to cancel" })
  @ApiNotFoundResponse({ description: "Order not found", type: ErrorResponseDto })
  cancelOrder(@CurrentUser() user: AuthenticatedUser, @Param("orderId") orderId: string) {
    return this.orderService.cancelOrder(user.sub, orderId);
  }

  @Get()
  @ApiOperation({ summary: "List orders with filters and pagination" })
  listOrders(@CurrentUser() user: AuthenticatedUser, @Query() query: ListOrdersQueryDto) {
    return this.orderService.listOrders(user.sub, query);
  }

  @Sse("stream")
  @ApiOperation({ summary: "Stream user orders with filters and pagination (SSE)" })
  @ApiProduces("text/event-stream")
  streamOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: StreamOrdersQueryDto
  ): Observable<MessageEvent> {
    return this.orderService.streamOrders(user.sub, query).pipe(
      map((payload) => ({
        data: payload
      }))
    );
  }
}
