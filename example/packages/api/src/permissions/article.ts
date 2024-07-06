import { Visibility, type Prisma } from '@churros/db/prisma';
import type { Context } from '../lib/index.js';
import {
  prismaGroupFilterForStudentAssociationAdmins,
  prismaGroupFilterForStudentAssociationGroupsEditors,
} from '../modules/users/index.js';

/**
 * Articles that the given user can see
 * **WARNING: DO *NOT* SPREAD THIS INTO A PRISMA QUERY's `where` DIRECTLY, USE "AND":**
 *
 * ```
 * where: { AND: [ prismaQueryAccessibleArticles(), { ... } ]
 * ```
 *
 * @param user the user
 * @param level if 'wants', only return articles that the user _wants_ to see, if 'can', shows all the articles they have access to
 * @returns a Prisma.ArticleWhereInput, an object to pass inside of a `where` field in a prisma query
 */
export function prismaQueryAccessibleArticles(
  user: Context['user'],
  level: 'can' | 'wants',
): Prisma.ArticleWhereInput {
  // Get the user's groups and their ancestors
  if (user?.admin && level === 'can') return {};

  if (user?.adminOfStudentAssociations.length && level === 'can') {
    return {
      group: prismaGroupFilterForStudentAssociationAdmins(user),
    };
  }

  if (user?.canEditGroups.length && level === 'can') {
    return {
      group: prismaGroupFilterForStudentAssociationGroupsEditors(user),
    };
  }

  return {
    OR: [
      {
        publishedAt: { lte: new Date() },
        // Published articles that are
        OR: [
          // Public
          { visibility: Visibility.Public },
          // SchoolRestricted and the user is a student of this school
          {
            visibility: Visibility.SchoolRestricted,
            group: {
              studentAssociation: {
                school: {
                  majors: {
                    some: {
                      students: {
                        some: {
                          uid: user?.uid ?? '',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          // GroupRestricted to the group and the user is a member of the group
          // or a member of a children group
          // TODO handle children of children
          {
            visibility: Visibility.GroupRestricted,
            group: {
              OR: [
                {
                  members: {
                    some: {
                      member: { uid: user?.uid ?? '' },
                    },
                  },
                },
                {
                  children: {
                    some: {
                      members: {
                        some: {
                          member: { uid: user?.uid ?? '' },
                        },
                      },
                    },
                  },
                },
              ],
            },
          },
        ],
      },

      // Or the user has permission to create articles
      {
        group: {
          members: {
            some: {
              member: { uid: user?.uid ?? '' },
              canEditArticles: true,
            },
          },
        },
      },

      // Or the user is the author
      {
        author: {
          uid: user?.uid ?? '',
        },
      },
    ],
  };
}
