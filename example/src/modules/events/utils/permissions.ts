import { type Context } from '#lib';
import { canScanBookings } from '#modules/ticketing';
import { onBoard, userIsAdminOf, userIsGroupEditorOf } from '#permissions';
import type { Event, EventManager, Group } from '@churros/db/prisma';

export function canEdit(
	event: Event & {
		managers: EventManager[];
		group: { studentAssociationId: string | null };
	},
	user: Context['user'],
) {
	if (userIsAdminOf(user, event.group.studentAssociationId)) return true;
	if (userIsGroupEditorOf(user, event.group.studentAssociationId))
		return true;
	if (event.authorId === user?.id) return true;

	const membership = user?.groups.find(
		({ group }) => group.id === event.groupId,
	);
	if (membership?.canEditArticles) return true;

	const managementship = event.managers.find((m) => m.userId === user?.id);
	return !!managementship?.canEdit;
}

export function canEditManagers(
	event: Event & { managers: EventManager[]; group: Group },
	user: Context['user'],
) {
	if (userIsAdminOf(user, event.group.studentAssociationId)) return true;
	if (event.authorId === user?.id) return true;

	const membership = user?.groups.find(
		({ group }) => group.id === event.groupId,
	);
	if (onBoard(membership)) return true;

	const managementship = event.managers.find((m) => m.userId === user?.id);
	return !!managementship?.canEditPermissions;
}

export function canSeeBookings(
	event: Event & {
		managers: EventManager[];
		group: Group;
	},
	user: Context['user'],
) {
	return canScanBookings(event, user) || canEdit(event, user);
}

export function canCreateEvent(group: Group, user: Context['user']) {
	if (userIsAdminOf(user, group.studentAssociationId)) return true;

	const membership = user?.groups.find((g) => g.group.id === group.id);
	if (membership?.canEditArticles) return true;
	if (onBoard(membership)) return true;

	return false;
}

export function canSeePlacesLeftCount(
	event: Event & {
		managers: Array<EventManager>;
		group: Group;
	},
	user: Context['user'],
	placesLeft: number,
) {
	return (
		placesLeft === 0 || event.showPlacesLeft || canSeeBookings(event, user)
	);
}

export function canSeeEventLogs(
	event: Event & { managers: EventManager[]; group: Group },
	user: Context['user'],
): boolean {
	return canScanBookings(event, user);
}
