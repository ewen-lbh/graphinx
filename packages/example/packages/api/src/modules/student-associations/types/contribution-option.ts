import { builder, toHtml } from '#lib';

export const ContributionOptionType = builder.prismaObject('ContributionOption', {
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    price: t.exposeFloat('price'),
    descriptionHtml: t.string({
      resolve: async ({ description }) => toHtml(description),
    }),
    paysFor: t.relation('paysFor'),
    offeredIn: t.relation('offeredIn'),
  }),
});
