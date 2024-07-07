import { builder, prisma, toHtml } from '#lib';

import { prismaQueryAccessibleArticles } from '#permissions';
import { PicturedInterface } from '../../global/types/pictured.js';
import { canEditGroup, GroupEnumType } from '../index.js';
import { requiredPrismaIncludesForPermissions } from '../utils/index.js';

export const GroupType = builder.prismaNode('Group', {
	id: { field: 'id' },
	include: requiredPrismaIncludesForPermissions,
	interfaces: [PicturedInterface],
	fields: (t) => ({
		// Because `id` is a Relay id, expose `groupId` as the real db id
		groupId: t.exposeID('id'),
		type: t.expose('type', { type: GroupEnumType }),
		uid: t.exposeString('uid'),
		parentId: t.exposeID('parentId', { nullable: true }),
		familyId: t.exposeID('familyId', { nullable: true }),
		name: t.exposeString('name'),
		color: t.exposeString('color'),
		address: t.exposeString('address'),
		description: t.exposeString('description'),
		email: t.exposeString('email'),
		mailingList: t.exposeString('mailingList'),
		longDescription: t.exposeString('longDescription'),
		longDescriptionHtml: t.string({
			resolve: async ({ longDescription }) => toHtml(longDescription),
		}),
		website: t.exposeString('website'),
		pictureFile: t.exposeString('pictureFile'),
		pictureFileDark: t.exposeString('pictureFileDark'),
		ldapUid: t.exposeString('ldapUid'),
		roomIsOpen: t.exposeBoolean('roomIsOpen', {
			authScopes: { student: true },
		}),
		articles: t.relation('articles', {
			query(_, { user }) {
				return {
					where: prismaQueryAccessibleArticles(user, 'wants'),
					orderBy: { publishedAt: 'desc' },
				};
			},
		}),
		services: t.relation('services'),
		links: t.relation('links'),
		members: t.relation('members', {
			// marche pas même quand ça devrait
			// authScopes: { student: true },
			query: {
				orderBy: [
					{ president: 'desc' },
					{ treasurer: 'desc' },
					{ member: { firstName: 'asc' } },
					{ member: { lastName: 'asc' } },
				],
			},
		}),
		president: t.prismaField({
			type: 'GroupMember',
			nullable: true,
			resolve: async (query, { id }) =>
				prisma.groupMember.findFirst({
					...query,
					where: { group: { id }, president: true },
				}),
		}),
		vicePresidents: t.prismaField({
			type: ['GroupMember'],
			resolve: async (query, { id }) =>
				prisma.groupMember.findMany({
					...query,
					where: { group: { id }, vicePresident: true },
				}),
		}),
		secretaries: t.prismaField({
			type: ['GroupMember'],
			resolve: async (query, { id }) =>
				prisma.groupMember.findMany({
					...query,
					where: { group: { id }, secretary: true },
				}),
		}),
		treasurers: t.prismaField({
			type: ['GroupMember'],
			resolve: async (query, { id }) =>
				prisma.groupMember.findMany({
					...query,
					where: { group: { id }, treasurer: true },
				}),
		}),
		boardMembers: t.prismaField({
			type: ['GroupMember'],
			resolve: async (query, { id }) =>
				prisma.groupMember.findMany({
					...query,
					where: {
						group: { id },
						OR: [
							{ president: true },
							{ vicePresident: true },
							{ secretary: true },
							{ treasurer: true },
						],
					},
				}),
		}),
		studentAssociation: t.relation('studentAssociation', {
			nullable: true,
		}),
		parent: t.relation('parent', { nullable: true }),
		selfJoinable: t.exposeBoolean('selfJoinable'),
		children: t.relation('children'),
		root: t.relation('familyRoot', { nullable: true }),
		familyChildren: t.relation('familyChildren'),
		related: t.relation('related'),
		shopItems: t.relation('shopItems'),
		canEditDetails: t.boolean({
			description:
				"Vrai si l'utilisateur·ice connecté·e peut modifier les informations du groupe",
			resolve: async (group, _, { user }) => {
				return canEditGroup(user, group);
			},
		}),
	}),
});
