# Backend Code Patterns

## Error Response Format

All errors go through AllExceptionsFilter (`/backend/src/common/filters/http-exception.filter.ts`):

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "이메일 또는 비밀번호가 올바르지 않습니다",
    "statusCode": 401,
    "timestamp": "2025-...",
    "path": "/api/v1/auth/login"
  }
}
```

## Success Response Format

TransformInterceptor wraps all responses:

```json
{ "success": true, "data": { ... } }
```

## Pagination Pattern

```typescript
import { buildPaginationMeta } from "../common/dto/pagination-query.dto";
// returns { data: T[], meta: { total, page, limit, totalPages } }
```

## Controller Pattern

- `@ApiBearerAuth('access-token')` -- named security scheme
- `@Roles(UserRole.ADMIN)` -- enum-based, not string
- `@HttpCode(HttpStatus.OK)` on POST endpoints that aren't creation
- Request user: `@Request() req: { user: JwtUser }`

## WebSocket Auth Pattern (CoachingGateway)

Token extraction priority: query.token > auth.token > Authorization header
Verified userId stored in `client.data.userId`

## Swagger Tags (defined in main.ts)

Auth, Users, Programs, Sessions, Coaching, Health, Devices, Support, Admin, Admin Support
