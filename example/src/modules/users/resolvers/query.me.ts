import { builder } from '#lib';

import { UserType } from '../index.js';

/** Returns the current user. */
builder.queryField('me', (t) =>
	t.withAuth({ loggedIn: true }).prismaField({
		directives: {
			rateLimit: { duration: 60, limit: 6000 },
		},
		type: UserType,
		resolve: (_query, _, {}, { user }) => user,
	}),
);
