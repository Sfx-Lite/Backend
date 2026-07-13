import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
/** Marks a route as reachable without a JWT (Squad A's auth guard reads this). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
