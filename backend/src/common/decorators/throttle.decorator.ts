import { SkipThrottle, Throttle } from "@nestjs/throttler";

export const ThrottleAuth = () => Throttle({ default: { limit: 5, ttl: 60000 } });
export const ThrottleRegister = () => Throttle({ default: { limit: 3, ttl: 60000 } });
export const ThrottleStrict = () => Throttle({ default: { limit: 10, ttl: 60000 } });
export { SkipThrottle };
