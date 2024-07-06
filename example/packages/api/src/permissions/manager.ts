import { type Context } from '#lib';

import type { Event } from '@churros/db/prisma';

export function userCanManageEvent(
  event: Event & {
    managers: Array<{
      user: { uid: string };

      canEdit: boolean;
      canEditPermissions: boolean;
      canVerifyRegistrations: boolean;
    }>;
  },
  user: Context['user'],
  required: { canEdit?: boolean; canEditPermissions?: boolean; canVerifyRegistrations?: boolean },
) {
  if (!user) return false;
  return Boolean(
    user.groups.some(({ groupId, canScanEvents }) => {
      if (groupId !== event.groupId) return false;
      if (
        required.canVerifyRegistrations &&
        canScanEvents &&
        !required.canEdit &&
        !required.canEditPermissions
      )
        return true;
      return false;
    }) ||
      event.managers.some(({ user: { uid }, ...permissions }) => {
        if (uid !== user.uid) return false;
        if (required.canEdit && !permissions.canEdit) return false;
        if (required.canEditPermissions && !permissions.canEditPermissions) return false;
        if (required.canVerifyRegistrations && !permissions.canVerifyRegistrations) return false;
        return true;
      }),
  );
}
