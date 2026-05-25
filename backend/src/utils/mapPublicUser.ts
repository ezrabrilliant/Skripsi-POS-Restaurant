// Mapper PublicUser: hilangkan field sensitif (pin) sebelum dikirim ke client.
// Dipakai oleh auth.service (response /login & /me) dan users.service (response CRUD).

import type { User } from '@prisma/client';

export type PublicUser = Omit<User, 'pin'>;

export function toPublicUser(user: User): PublicUser {
  const { pin: _pin, ...publicUser } = user;
  return publicUser;
}
